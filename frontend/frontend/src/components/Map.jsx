import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import "../styles/Map.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const MASK_SOURCE_ID = "deforestation-mask-source";
const MASK_LAYER_ID = "deforestation-mask-layer";

export default function Map({
  query,
  setQuery,
  suggestions,
  setSuggestions,
  parsedRequest,
  onUpdateShape,
  deforestationResult,
  deforestationPanelOpen,
  panelOpen,
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const featureIdRef = useRef(null);

  const [activeOverlay, setActiveOverlay] = useState("change");

  // Convert meters to lat/lng degrees
  const metersToLatDegrees = (meters) => meters / 110574;
  const metersToLngDegrees = (lat, meters) => meters / (111320 * Math.cos((lat * Math.PI) / 180));

  // -----------------------
  // Helpers: normalize parsedRequest
  // -----------------------
  const toNumberOrNull = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const normalizeDistanceToMeters = (d) => {
    if (d == null) return 2000;
    const n = Number(d);
    return Number.isFinite(n) ? n : 2000; // always meters
  };

  const normalizeParsedRequest = (req) => {
    if (!req) return null;

    let lat = toNumberOrNull(req.latitude);
    let lng = toNumberOrNull(req.longitude);

    // object { latitude, longitude }
    if ((lat == null || lng == null) && req.location && typeof req.location === "object" && !Array.isArray(req.location)) {
      lat = lat ?? toNumberOrNull(req.location.latitude ?? req.location.lat);
      lng = lng ?? toNumberOrNull(req.location.longitude ?? req.location.lng ?? req.location.lon);
    }

    // string "lat, lng"
    if ((lat == null || lng == null) && typeof req.location === "string") {
      const parts = req.location.split(",").map((p) => toNumberOrNull(p.trim()));
      if (parts.length >= 2) {
        const [a0, a1] = parts;
        const a0IsLat = a0 >= -90 && a0 <= 90;
        const a1IsLat = a1 >= -90 && a1 <= 90;
        const a0IsLng = a0 >= -180 && a0 <= 180;
        const a1IsLng = a1 >= -180 && a1 <= 180;
        if (a0IsLat && a1IsLng && !(a1IsLat && a0IsLng)) { lat = a0; lng = a1; }
        else if (a0IsLng && a1IsLat && !(a1IsLng && a0IsLat)) { lat = a1; lng = a0; }
        else { lat = a0; lng = a1; }
      }
    }

    // array [lat,lng] or [lng,lat]
    if ((lat == null || lng == null) && Array.isArray(req.location) && req.location.length >= 2) {
      const [a0, a1] = req.location.map(toNumberOrNull);
      const a0IsLat = a0 >= -90 && a0 <= 90;
      const a1IsLat = a1 >= -90 && a1 <= 90;
      const a0IsLng = a0 >= -180 && a0 <= 180;
      const a1IsLng = a1 >= -180 && a1 <= 180;
      if (a0IsLat && a1IsLng && !(a1IsLat && a0IsLng)) { lat = a0; lng = a1; }
      else if (a0IsLng && a1IsLat && !(a1IsLng && a0IsLat)) { lat = a1; lng = a0; }
      else { lat = a0; lng = a1; }
    }

    const distanceMeters = normalizeDistanceToMeters(req.distance_to_edge ?? req.distance_to_edge_m ?? req.distance_to_edge_meters);

    if (lat == null || lng == null) return null;

    // clamp to valid lat/lng ranges
    lat = Math.max(-90, Math.min(90, lat));
    lng = Math.max(-180, Math.min(180, lng));

    return { latitude: lat, longitude: lng, distance_to_edge: distanceMeters };
  };

  // Initialize map & draw
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [74.303056, 31.481111],
      zoom: 12,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl());

    drawRef.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: { trash: true },
      defaultMode: "simple_select",
    });
    mapRef.current.addControl(drawRef.current);
  }, []);

  // Draw/update square
  useEffect(() => {
    if (!mapRef.current || !drawRef.current) return;

    const obj = deforestationPanelOpen && deforestationResult
      ? deforestationResult
      : normalizeParsedRequest(parsedRequest);

    if (!obj || obj.latitude == null || obj.longitude == null) return;

    const lat = obj.latitude;
    const lng = obj.longitude;
    const distance = obj.distance_to_edge ?? 2000;

    const latDelta = metersToLatDegrees(distance);
    const lngDelta = metersToLngDegrees(lat, distance);

    const bl = [lng - lngDelta, lat - latDelta];
    const br = [lng + lngDelta, lat - latDelta];
    const tr = [lng + lngDelta, lat + latDelta];
    const tl = [lng - lngDelta, lat + latDelta];

    const square = {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [[bl, br, tr, tl, bl]] },
    };

    try {
      if (featureIdRef.current && drawRef.current.get(featureIdRef.current)) {
        drawRef.current.setFeatureCoordinates(featureIdRef.current, square.geometry.coordinates[0]);
      } else {
        const created = drawRef.current.add(square);
        featureIdRef.current = created[0];
      }
      drawRef.current.changeMode("direct_select", { featureId: featureIdRef.current });
    } catch (err) {
      console.error("Error adding/updating square:", err);
    }

    try {
      mapRef.current.fitBounds(
        [
          [Math.min(bl[0], br[0], tr[0], tl[0]), Math.min(bl[1], br[1], tr[1], tl[1])],
          [Math.max(bl[0], br[0], tr[0], tl[0]), Math.max(bl[1], br[1], tr[1], tl[1])],
        ],
        { padding: 40 }
      );
    } catch {}

    onUpdateShape({ center: [lng, lat], distance_to_edge: distance });
  }, [parsedRequest, deforestationResult, deforestationPanelOpen]);

  // Deforestation overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!deforestationPanelOpen && !panelOpen) {
      if (map.getLayer(MASK_LAYER_ID)) map.removeLayer(MASK_LAYER_ID);
      if (map.getSource(MASK_SOURCE_ID)) map.removeSource(MASK_SOURCE_ID);
      if (featureIdRef.current && drawRef.current.get(featureIdRef.current)) {
        drawRef.current.delete(featureIdRef.current);
        featureIdRef.current = null;
      }
      return;
    }

    if (!deforestationPanelOpen || !deforestationResult) return;

    const BACKEND_URL = "http://localhost:8000/media";
    const beforeUrl = deforestationResult.deforestation_result?.before_image_path
      ? `${BACKEND_URL}/${deforestationResult.deforestation_result.before_image_path}` : null;
    const afterUrl = deforestationResult.deforestation_result?.after_image_path
      ? `${BACKEND_URL}/${deforestationResult.deforestation_result.after_image_path}` : null;
    const changeUrl = deforestationResult.deforestation_result?.mask_path
      ? `${BACKEND_URL}/${deforestationResult.deforestation_result.mask_path}` : null;

    const selectedUrl = activeOverlay === "before"
      ? beforeUrl
      : activeOverlay === "after"
      ? afterUrl
      : changeUrl;

    const addMask = () => {
      const lat = deforestationResult.latitude;
      const lng = deforestationResult.longitude;
      const distance = deforestationResult.distance_to_edge ?? 2000;

      if (!selectedUrl || lat == null || lng == null) return;

      const latDelta = metersToLatDegrees(distance);
      const lngDelta = metersToLngDegrees(lat, distance);

      const tl = [lng - lngDelta, lat + latDelta];
      const tr = [lng + lngDelta, lat + latDelta];
      const br = [lng + lngDelta, lat - latDelta];
      const bl = [lng - lngDelta, lat - latDelta];

      try {
        if (map.getLayer(MASK_LAYER_ID)) map.removeLayer(MASK_LAYER_ID);
        if (map.getSource(MASK_SOURCE_ID)) map.removeSource(MASK_SOURCE_ID);

        map.addSource(MASK_SOURCE_ID, {
          type: "image",
          url: selectedUrl,
          coordinates: [tl, tr, br, bl],
        });

        map.addLayer({
          id: MASK_LAYER_ID,
          type: "raster",
          source: MASK_SOURCE_ID,
          paint: { "raster-opacity": 0.5 },
        });
      } catch (err) {
        console.error("Error adding deforestation mask:", err);
      }
    };

    if (map.isStyleLoaded()) addMask();
    else {
      map.on("load", addMask);
      return () => map.off("load", addMask);
    }
  }, [deforestationResult, deforestationPanelOpen, activeOverlay]);

  // Search box
  const handleChange = async (e) => {
    const value = e.target.value;
    setQuery(value);
    if (!value) return setSuggestions([]);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          value
        )}.json?autocomplete=true&limit=5&country=pk&access_token=${mapboxgl.accessToken}`
      );
      const data = await res.json();
      setSuggestions(data.features || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelect = (feature) => {
    if (!feature?.center) return;
    const [lng, lat] = feature.center;
    mapRef.current.flyTo({ center: [lng, lat], zoom: 12 });
    setQuery(feature.place_name);
    setSuggestions([]);
  };

  return (
    <div className="map-container">
      <input
        type="text"
        placeholder="Search location..."
        className="map-search"
        value={query}
        onChange={handleChange}
      />
      {suggestions.length > 0 && (
        <ul className="autocomplete-list">
          {suggestions.map((f) => (
            <li key={f.id} onClick={() => handleSelect(f)}>
              {f.place_name}
            </li>
          ))}
        </ul>
      )}

      {deforestationPanelOpen && (
        <div className="overlay-toggle-buttons">
          <button className={activeOverlay === "before" ? "active" : ""} onClick={() => setActiveOverlay("before")}>Before</button>
          <button className={activeOverlay === "after" ? "active" : ""} onClick={() => setActiveOverlay("after")}>After</button>
          <button className={activeOverlay === "change" ? "active" : ""} onClick={() => setActiveOverlay("change")}>Change</button>
        </div>
      )}

      <div ref={mapContainer} className="map-inner" />
    </div>
  );
}
