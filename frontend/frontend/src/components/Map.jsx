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
  panelOpen
}) {
  console.log(parsedRequest);
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const featureIdRef = useRef(null);

  const [activeOverlay, setActiveOverlay] = useState("change");

  const metersToLatDegrees = (m) => m / 110574.0;
  const metersToLngDegrees = (lat, m) =>
    m / (111320.0 * Math.cos((lat * Math.PI) / 180));

  // Initialize map & draw
  useEffect(() => {
    if (mapRef.current) return;
    if (!mapContainer.current) return;

    mapRef.current = new mapboxgl.Map({ //31.481111, 74.303056
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-v9",
      center: [74.303056, 31.481111],
      zoom: 9,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl());

    drawRef.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: { trash: true },
      defaultMode: "simple_select",
    });
    mapRef.current.addControl(drawRef.current);
  }, []);

  // Draw/update square (request or deforestation)
  useEffect(() => {
    if (!mapRef.current || !drawRef.current) return;

    const obj =
      deforestationPanelOpen && deforestationResult
        ? deforestationResult
        : parsedRequest
        ? {
            latitude: parsedRequest.latitude ?? parsedRequest.location?.[0],
            longitude: parsedRequest.longitude ?? parsedRequest.location?.[1],
            distance_to_edge: parsedRequest.distance_to_edge ?? 2000,
          }
        : null;

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
      if (
        featureIdRef.current &&
        drawRef.current.get(featureIdRef.current)
      ) {
        drawRef.current.setFeatureCoordinates(
          featureIdRef.current,
          square.geometry.coordinates[0]
        );
      } else {
        const created = drawRef.current.add(square);
        featureIdRef.current = created[0];
      }
      drawRef.current.changeMode("direct_select", {
        featureId: featureIdRef.current,
      });
    } catch (err) {
      console.error("Error adding/updating square:", err);
    }

    try {
      mapRef.current.fitBounds(
        [
          [
            Math.min(bl[0], br[0], tr[0], tl[0]),
            Math.min(bl[1], br[1], tr[1], tl[1]),
          ],
          [
            Math.max(bl[0], br[0], tr[0], tl[0]),
            Math.max(bl[1], br[1], tr[1], tl[1]),
          ],
        ],
        { padding: 40 }
      );
    } catch {}

    onUpdateShape({ center: [lng, lat], distance_to_edge: distance });
  }, [parsedRequest, deforestationResult, deforestationPanelOpen]);

  // Enforce square when dragging
  useEffect(() => {
    if (!drawRef.current || !mapRef.current) return;

    const handleUpdate = (e) => {
      const feat = e.features?.[0];
      if (!feat) return;
      const coords = feat.geometry.coordinates?.[0]?.slice(0, 4);
      if (!coords) return;

      const centerLat =
        (Math.min(...coords.map((c) => c[1])) +
          Math.max(...coords.map((c) => c[1]))) /
        2;
      const centerLng =
        (Math.min(...coords.map((c) => c[0])) +
          Math.max(...coords.map((c) => c[0]))) /
        2;

      const halfSideLat = Math.max(
        ...coords.map((c) => Math.abs(c[1] - centerLat))
      );
      const halfSideLng = Math.max(
        ...coords.map((c) => Math.abs(c[0] - centerLng))
      );
      const halfSide = Math.max(halfSideLat, halfSideLng);

      const newCoords = [
        [centerLng - halfSide, centerLat - halfSide],
        [centerLng + halfSide, centerLat - halfSide],
        [centerLng + halfSide, centerLat + halfSide],
        [centerLng - halfSide, centerLat + halfSide],
        [centerLng - halfSide, centerLat - halfSide],
      ];

      try {
        drawRef.current.setFeatureCoordinates(feat.id, newCoords);
        onUpdateShape({
          center: [centerLng, centerLat],
          distance_to_edge: (halfSide * 111000) / 1000,
        });
      } catch (err) {
        console.error("Error updating feature coordinates:", err);
      }
    };

    mapRef.current.on("draw.update", handleUpdate);
    mapRef.current.on("draw.create", handleUpdate);
    return () => {
      mapRef.current.off("draw.update", handleUpdate);
      mapRef.current.off("draw.create", handleUpdate);
    };
  }, [onUpdateShape]);

  // Deforestation overlay
  useEffect(() => {
    const map = mapRef.current;

    if (!deforestationPanelOpen && !panelOpen) {
      if (map.getLayer(MASK_LAYER_ID)) map.removeLayer(MASK_LAYER_ID);
      if (map.getSource(MASK_SOURCE_ID)) map.removeSource(MASK_SOURCE_ID);

      if (featureIdRef.current && drawRef.current.get(featureIdRef.current)) {
        drawRef.current.delete(featureIdRef.current);
        featureIdRef.current = null;
      }

    return;
    }

    if (!map || !deforestationPanelOpen || !deforestationResult) return;

    const BACKEND_URL = "http://localhost:8000/media";

    const beforeUrl = deforestationResult.deforestation_result.before_image_path
      ? `${BACKEND_URL}/${deforestationResult.deforestation_result.before_image_path}`
      : null;
    const afterUrl = deforestationResult.deforestation_result.after_image_path
      ? `${BACKEND_URL}/${deforestationResult.deforestation_result.after_image_path}`
      : null;
    const changeUrl = deforestationResult.deforestation_result.mask_path
      ? `${BACKEND_URL}/${deforestationResult.deforestation_result.mask_path}`
      : null;

    const selectedUrl =
      activeOverlay === "before"
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

      {/* Overlay Toggle Buttons — ONLY when deforestation panel open AND mask exists */}
      {deforestationPanelOpen && (
          <div className="overlay-toggle-buttons">
            <button
              className={activeOverlay === "before" ? "active" : ""}
              onClick={() => setActiveOverlay("before")}
            >
              Before
            </button>
            <button
              className={activeOverlay === "after" ? "active" : ""}
              onClick={() => setActiveOverlay("after")}
            >
              After
            </button>
            <button
              className={activeOverlay === "change" ? "active" : ""}
              onClick={() => setActiveOverlay("change")}
            >
              Change
            </button>
          </div>
      )}


      <div ref={mapContainer} className="map-inner" />
    </div>
  );
}
