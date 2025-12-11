import os
import requests
import shutil
import numpy as np
import rasterio
from rasterio.mask import mask
from rasterio.warp import reproject, Resampling
from shapely.geometry import box
import pyproj
from shapely.ops import transform
from pathlib import Path
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ==========================================
# 1. AUTH + CONFIG
# ==========================================
CLIENT_ID="sh-68f61fde-814f-4f17-bcdc-df2576c9ae2a"
CLIENT_SECRET="Z7J0TDPNmzLI8FCntxZ4D422khZDV8Lc"

TARGET_BANDS = ["B02", "B03", "B04", "B05", "B06", "B07", "B8A", "B11", "B12"]

OUTPUT_BASE = Path("./data")
OUTPUT_BEFORE = OUTPUT_BASE / "Amazon_Before"
OUTPUT_AFTER = OUTPUT_BASE / "Amazon_After"
OUTPUT_BEFORE.mkdir(parents=True, exist_ok=True)
OUTPUT_AFTER.mkdir(parents=True, exist_ok=True)

# ==========================================
# 2. SESSION CLASS
# ==========================================
class CDSESession:
    def __init__(self):
        self.token = None
        self.session = requests.Session()

        retries = Retry(
            total=5,
            backoff_factor=1,
            status_forcelist=[500, 502, 503, 504]
        )
        self.session.mount("https://", HTTPAdapter(max_retries=retries))

        self.authenticate()

    def authenticate(self):
        url = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
        payload = {
            "grant_type": "client_credentials",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        }
        try:
            r = self.session.post(url, data=payload, timeout=30)
            r.raise_for_status()
            self.token = r.json()["access_token"]
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        except Exception as e:
            print(f"❌ Auth failed: {e}")
            raise e

    def get(self, url, **kwargs):
        if "timeout" not in kwargs:
            kwargs["timeout"] = 60

        try:
            r = self.session.get(url, **kwargs)

            # Token expired → re-auth
            if r.status_code in (401, 403):
                self.authenticate()
                r = self.session.get(url, **kwargs)

            return r
        except Exception:
            return None


API = CDSESession()

# ==========================================
# 3. SEARCH
# ==========================================
def get_candidates(lat, lon, start_date, end_date):
    base = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"
    delta = 0.02

    poly_str = (
        f"{lon-delta} {lat-delta}, {lon+delta} {lat-delta}, "
        f"{lon+delta} {lat+delta}, {lon-delta} {lat+delta}, "
        f"{lon-delta} {lat-delta}"
    )

    def search(ptype):
        filt = (
            f"Collection/Name eq 'SENTINEL-2' and "
            f"Attributes/OData.CSC.StringAttribute/any(a:a/Name eq 'productType' "
            f"and a/OData.CSC.StringAttribute/Value eq '{ptype}') and "
            f"ContentDate/Start gt {start_date}T00:00:00.000Z and "
            f"ContentDate/Start lt {end_date}T00:00:00.000Z and "
            f"OData.CSC.Intersects(area=geography'SRID=4326;POLYGON(({poly_str}))')"
        )

        params = {"$filter": filt, "$top": 20, "$orderby": "ContentDate/Start asc", "$expand": "Attributes"}

        r = API.get(base, params=params)
        if r and r.status_code == 200:
            return r.json().get("value", [])
        return []

    products = search("S2MSI2A")
    if not products:
        products = search("S2MSI1C")
    if not products:
        return []

    return sorted(
        products,
        key=lambda x: float(
            next((a["Value"] for a in x["Attributes"] if a["Name"] == "cloudCover"), 100)
        ),
    )


# ==========================================
# 4. DOWNLOAD + CROP + STACK
# ==========================================
def process_product(product, lat, lon, out_dir, target_filename):
    out_dir = Path(out_dir)
    name = product["Name"]
    prod_id = product["Id"]

    zip_path = out_dir / f"{name}.zip"
    final = out_dir / target_filename
    temp_dir = out_dir / f"temp_{name}"

    # Already downloaded?
    if final.exists() and final.stat().st_size > 1_000_000:
        return True

    if final.exists():
        final.unlink()

    try:
        # Download
        url = f"https://catalogue.dataspace.copernicus.eu/odata/v1/Products({prod_id})/$value"
        r = API.get(url, stream=True, allow_redirects=False)
        if not r:
            return False

        # Redirect
        if r.status_code in (301, 302, 303, 307, 308):
            r = API.get(r.headers["Location"], stream=True)

        if not r or r.status_code != 200:
            return False

        # Save ZIP
        with open(zip_path, "wb") as f:
            for chunk in r.iter_content(1024 * 1024):
                if chunk:
                    f.write(chunk)

        # Extract
        shutil.unpack_archive(zip_path, temp_dir)

        # Find JP2 bands
        band_paths = {}
        for f in temp_dir.rglob("*.jp2"):
            for b in TARGET_BANDS:
                if f"_{b}_" in f.name or f.name.endswith(f"_{b}.jp2"):
                    band_paths[b] = f

        if len(band_paths) < 9:
            return False

        # 20 km crop
        delta_deg = (20.0 / 111.0) / 2.0
        geom = box(lon - delta_deg, lat - delta_deg, lon + delta_deg, lat + delta_deg)

        ref_band = band_paths["B02"]

        with rasterio.open(ref_band) as src:
            transform_fn = pyproj.Transformer.from_crs(
                pyproj.CRS("EPSG:4326"), src.crs, always_xy=True
            ).transform
            utm_geom = transform(transform_fn, geom)

            try:
                ref_img, ref_tf = mask(src, [utm_geom], crop=True)
            except Exception:
                return False

            # Empty/black check
            if ref_img.shape[1] < 100 or np.max(ref_img) == 0:
                return False

            out_meta = src.meta.copy()
            out_meta.update(
                {
                    "driver": "GTiff",
                    "height": ref_img.shape[1],
                    "width": ref_img.shape[2],
                    "transform": ref_tf,
                    "count": 9,
                    "dtype": "float32",
                }
            )

        ref_h, ref_w = ref_img.shape[1], ref_img.shape[2]

        # Stack
        stack = []
        for b in TARGET_BANDS:
            with rasterio.open(band_paths[b]) as src:
                d, _ = mask(src, [utm_geom], crop=True)
                if d.shape[1] != ref_h:
                    dst = np.zeros((ref_h, ref_w), dtype="float32")
                    reproject(
                        d[0],
                        dst,
                        src_transform=src.transform,
                        src_crs=src.crs,
                        dst_transform=out_meta["transform"],
                        dst_crs=out_meta["crs"],
                        resampling=Resampling.bilinear,
                    )
                    stack.append(dst)
                else:
                    stack.append(d[0].astype("float32"))

        # Save final
        with rasterio.open(final, "w", **out_meta) as dest:
            dest.write(np.stack(stack))

        return True

    except Exception:
        return False

    finally:
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
        if zip_path.exists():
            try:
                zip_path.unlink()
            except:
                pass


# ==========================================
# 5. MAIN SINGLE FUNCTION FOR CELERY
# ==========================================
def download_pair(lat, lon, location_id):
    """
    Returns:
        (before_path, after_path)
    """
    before_name = f"{location_id}_BEFORE.tif"
    after_name = f"{location_id}_AFTER.tif"

    before_path = OUTPUT_BEFORE / before_name
    after_path = OUTPUT_AFTER / after_name

    # BEFORE (2019)
    if not before_path.exists():
        cands = get_candidates(lat, lon, "2019-01-01", "2019-12-31")
        for p in cands[:10]:
            if process_product(p, lat, lon, OUTPUT_BEFORE, before_name):
                break

    # AFTER (2023)
    if not after_path.exists():
        cands = get_candidates(lat, lon, "2023-01-01", "2023-12-31")
        for p in cands[:10]:
            if process_product(p, lat, lon, OUTPUT_AFTER, after_name):
                break

    if before_path.exists() and after_path.exists():
        return str(before_path), str(after_path)

    # if only one exists, clean up
    if before_path.exists():
        before_path.unlink()
    return None, None
