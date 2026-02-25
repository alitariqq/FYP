import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import "../styles/Map.css";
import MapControls from "./mapControls/MapControls";
import { v4 as uuidv4 } from "uuid";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const MASK_SOURCE_ID = "deforestation-mask-source";
const MASK_LAYER_ID = "deforestation-mask-layer";
const LULC_SOURCE_ID = "lulc-overlay-source";
const LULC_LAYER_ID = "lulc-overlay-layer";

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
  lulcResult,
  selectedLulcYearIndex,
  lulcPanelOpen,
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const featureIdRef = useRef(null);

  const [mapReady, setMapReady] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState("change"); // deforestation
  const [lulcOverlayType, setLulcOverlayType] = useState("imagery"); // "imagery" or "mask"

  // Helpers: convert meters to lat/lng degrees
  const metersToLatDegrees = (meters) => meters / 110574;
  const metersToLngDegrees = (lat, meters) => meters / (111320 * Math.cos((lat * Math.PI) / 180));

  // Helpers: normalize parsedRequest
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

    if ((lat == null || lng == null) && req.location && typeof req.location === "object" && !Array.isArray(req.location)) {
      lat = lat ?? toNumberOrNull(req.location.latitude ?? req.location.lat);
      lng = lng ?? toNumberOrNull(req.location.longitude ?? req.location.lng ?? req.location.lon);
    }

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

    return { latitude: lat, longitude: lng, distance_to_edge: distanceMeters };
  };

  // Initialize map & draw
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [74.303056, 31.481111],
      zoom: 12,
    });
    mapRef.current = m;

    m.on("load", () => setMapReady(true));
    m.addControl(new mapboxgl.NavigationControl());

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { trash: true },
      defaultMode: "simple_select",
    });
    drawRef.current = draw;
    m.addControl(draw);
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

    const square = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[bl, br, tr, tl, bl]] } };

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
      mapRef.current.fitBounds([[Math.min(bl[0], br[0], tr[0], tl[0]), Math.min(bl[1], br[1], tr[1], tl[1])],
                               [Math.max(bl[0], br[0], tr[0], tl[0]), Math.max(bl[1], br[1], tr[1], tl[1])]], { padding: 40 });
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
    const beforeUrl = deforestationResult.deforestation_result?.before_image_path ? `${BACKEND_URL}/${deforestationResult.deforestation_result.before_image_path}` : null;
    const afterUrl = deforestationResult.deforestation_result?.after_image_path ? `${BACKEND_URL}/${deforestationResult.deforestation_result.after_image_path}` : null;
    const changeUrl = deforestationResult.deforestation_result?.mask_path ? `${BACKEND_URL}/${deforestationResult.deforestation_result.mask_path}` : null;

    const selectedUrl = activeOverlay === "before" ? beforeUrl : activeOverlay === "after" ? afterUrl : changeUrl;

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

      if (map.getLayer(MASK_LAYER_ID)) map.removeLayer(MASK_LAYER_ID);
      if (map.getSource(MASK_SOURCE_ID)) map.removeSource(MASK_SOURCE_ID);

      map.addSource(MASK_SOURCE_ID, { type: "image", url: selectedUrl, coordinates: [tl, tr, br, bl] });
      map.addLayer({ id: MASK_LAYER_ID, type: "raster", source: MASK_SOURCE_ID, paint: { "raster-opacity": 0.5 } });
    };

    if (map.isStyleLoaded()) addMask();
    else { map.on("load", addMask); return () => map.off("load", addMask); }
  }, [deforestationResult, deforestationPanelOpen, activeOverlay]);

  // LULC overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!lulcPanelOpen) {
      if (map.getLayer(LULC_LAYER_ID)) map.removeLayer(LULC_LAYER_ID);
      if (map.getSource(LULC_SOURCE_ID)) map.removeSource(LULC_SOURCE_ID);
      if (featureIdRef.current && drawRef.current.get(featureIdRef.current)) {
        drawRef.current.delete(featureIdRef.current);
        featureIdRef.current = null;
      }
      return;
    }


    if (!map || !lulcResult?.year_results?.length) return;


    const addLULCOverlay = () => {
      const yearData = lulcResult.year_results[selectedLulcYearIndex];
      const imagePath = lulcOverlayType === "imagery" ? yearData.image_path : yearData.mask_path;
      const BACKEND_URL = "http://localhost:8000/media";
      const url = imagePath ? `${BACKEND_URL}/${imagePath}` : null;

      if (!url) return;

      const lat = lulcResult.parsed_request?.latitude ?? 0;
      console.log(lat);
      const lng = lulcResult.parsed_request?.longitude ?? 0;
      console.log(lng);
      const distance = lulcResult.parsed_request?.distance_to_edge ?? 2000;
      console.log(distance);
      if (!lat || !lng) return;

      // Mapbox overlay using center + distance
      // lng, lat = center coordinates
      // distance = meters from center to edge

      const R = 6378137; // Earth radius in meters
      const latRad = lat * Math.PI / 180;

      // Longitude: approximate linear conversion
      const deltaLng = (distance / (R * Math.cos(latRad))) * (180 / Math.PI);

      // Latitude: use Web Mercator projection for accuracy
      const y = Math.log(Math.tan(Math.PI / 4 + latRad / 2)) * R;
      const northY = y + distance;
      const southY = y - distance;

      const northLat = (2 * Math.atan(Math.exp(northY / R)) - Math.PI / 2) * 180 / Math.PI;
      const southLat = (2 * Math.atan(Math.exp(southY / R)) - Math.PI / 2) * 180 / Math.PI;

      // Compute west/east
      const west = lng - deltaLng;
      const east = lng + deltaLng;

      // Mapbox image corners (TL, TR, BR, BL)
      const tl = [west, northLat];
      const tr = [east, northLat];
      const br = [east, southLat];
      const bl = [west, southLat];

      console.log("TL:", tl);
      console.log("TR:", tr);
      console.log("BR:", br);
      console.log("BL:", bl);

      if (map.getLayer(LULC_LAYER_ID)) map.removeLayer(LULC_LAYER_ID);
      if (map.getSource(LULC_SOURCE_ID)) map.removeSource(LULC_SOURCE_ID);

      map.flyTo({ center: [lng, lat], zoom: 11 });

      map.addSource(LULC_SOURCE_ID, { type: "image", url, coordinates: [tl, tr, br, bl] });
      map.addLayer({ id: LULC_LAYER_ID, type: "raster", source: LULC_SOURCE_ID, paint: { "raster-opacity": 1.0} });
    };

    if (map.isStyleLoaded()) {
      addLULCOverlay();
    } else {
      map.on("load", addLULCOverlay);
      return () => map.off("load", addLULCOverlay);
    }
  }, [lulcResult, selectedLulcYearIndex, lulcOverlayType, lulcPanelOpen]);

  // Search box & autocomplete
  const sessionTokenRef = useRef(uuidv4());

  const handleChange = async (e) => {
    const input = e.target.value;
    setQuery(input);

    if (!input) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": import.meta.env.VITE_GOOGLE_MAPS_KEY,
          "X-Goog-FieldMask": "suggestions.placePrediction.text,suggestions.placePrediction.placeId,suggestions.queryPrediction.text.text",
        },
        body: JSON.stringify({ input, includeQueryPredictions: true, sessionToken: sessionTokenRef.current }),
      });

      const data = await response.json();
      const formatted = (data.suggestions || [])
        .map((s) => {
          if (s.placePrediction) return { id: s.placePrediction.placeId, text: s.placePrediction.text.text, type: "place" };
          if (s.queryPrediction) return { id: s.queryPrediction.text.text, text: s.queryPrediction.text.text, type: "query" };
          return null;
        })
        .filter(Boolean);
      setSuggestions(formatted);
    } catch (err) {
      console.error("Autocomplete REST error:", err);
      setSuggestions([]);
    }
  };

  const handleSelect = async (prediction) => {
    if (prediction.type === "query") { setQuery(prediction.text); setSuggestions([]); return; }

    const placeId = prediction.id;
    if (!placeId) return;

    try {
      const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;
      const FIELD_MASK = "location";
      const url = `https://places.googleapis.com/v1/places/${placeId}?fields=${FIELD_MASK}`;
      const response = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": API_KEY, "X-Goog-FieldMask": FIELD_MASK } });
      const data = await response.json();
      if (!data.location) return;

      const { latitude, longitude } = data.location;
      mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 14 });
      setQuery(prediction.text);
      setSuggestions([]);
      onUpdateShape({ center: [longitude, latitude], distance_to_edge: 2000 });
    } catch (err) { console.error("Error fetching place details:", err); }
  };

  return (
    <div className="map-container">
      <input type="text" placeholder="Search location..." className="map-search" value={query} onChange={handleChange} />
      {suggestions.length > 0 && (
        <ul className="autocomplete-list">
          {suggestions.map((f, idx) => (
            <li key={(f.placePrediction?.placeId || f.text) + idx} onClick={() => handleSelect(f)}>{f.text}</li>
          ))}
        </ul>
      )}

      {/* Deforestation overlay toggle buttons */}
      {deforestationPanelOpen && (
        <div className="overlay-toggle-buttons">
          <button className={activeOverlay === "before" ? "active" : ""} onClick={() => setActiveOverlay("before")}>Before</button>
          <button className={activeOverlay === "after" ? "active" : ""} onClick={() => setActiveOverlay("after")}>After</button>
          <button className={activeOverlay === "change" ? "active" : ""} onClick={() => setActiveOverlay("change")}>Change</button>
        </div>
      )}

      {/* LULC overlay toggle buttons */}
      {lulcResult?.year_results?.length > 0 && (
        <div className="overlay-toggle-buttons">
          <button className={lulcOverlayType === "imagery" ? "active" : ""} onClick={() => setLulcOverlayType("imagery")}>Imagery</button>
          <button className={lulcOverlayType === "mask" ? "active" : ""} onClick={() => setLulcOverlayType("mask")}>Mask</button>
        </div>
      )}

      {mapReady && <MapControls map={mapRef.current} />}
      <div ref={mapContainer} className="map-inner" />
    </div>
  );
}
