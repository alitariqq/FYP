import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import "../styles/Map.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function Map({
  query,
  setQuery,
  suggestions,
  setSuggestions,
  parsedRequest,
  onUpdateShape,
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const featureIdRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-v9",
      center: [73.07, 31.41],
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

  const isValidLatLng = (lat, lng) =>
    typeof lat === "number" &&
    typeof lng === "number" &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  const createSquareFromCenter = (centerLat, centerLng, halfKm) => {
    const latDelta = halfKm / 111;
    const lngDelta = halfKm / (111 * Math.cos((centerLat * Math.PI) / 180));
    const bl = [centerLng - lngDelta, centerLat - latDelta];
    const br = [centerLng + lngDelta, centerLat - latDelta];
    const tr = [centerLng + lngDelta, centerLat + latDelta];
    const tl = [centerLng - lngDelta, centerLat + latDelta];
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [[bl, br, tr, tl, bl]] },
    };
  };

  const degsToKm = (latDeltaDeg, lngDeltaDeg, centerLat) => ({
    latKm: latDeltaDeg * 111,
    lngKm: lngDeltaDeg * 111 * Math.cos((centerLat * Math.PI) / 180),
  });

  const snapPolygonToSquare = (coords) => {
    const lats = coords.map(c => c[1]);
    const lngs = coords.map(c => c[0]);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

    const { latKm, lngKm } = degsToKm(
      Math.max(...lats) - Math.min(...lats),
      Math.max(...lngs) - Math.min(...lngs),
      centerLat
    );
    const halfSideKm = Math.max(latKm, lngKm) / 2;

    const latDeltaDeg = halfSideKm / 111;
    const lngDeltaDeg = halfSideKm / (111 * Math.cos(centerLat * Math.PI / 180));

    const bl = [centerLng - lngDeltaDeg, centerLat - latDeltaDeg];
    const br = [centerLng + lngDeltaDeg, centerLat - latDeltaDeg];
    const tr = [centerLng + lngDeltaDeg, centerLat + latDeltaDeg];
    const tl = [centerLng - lngDeltaDeg, centerLat + latDeltaDeg];

    return { coordinates: [[bl, br, tr, tl, bl]], center: [centerLng, centerLat], halfSideKm };
  };

  // Add or update square
  useEffect(() => {
    if (!mapRef.current || !drawRef.current || !parsedRequest) return;

    let centerLat, centerLng;
    if (parsedRequest.location) {
      if (Array.isArray(parsedRequest.location)) {
        const [a0, a1] = parsedRequest.location;
        if (Math.abs(a0) <= 90 && Math.abs(a1) <= 180) {
          centerLat = a0; centerLng = a1;
        } else {
          centerLat = a1; centerLng = a0;
        }
      } else {
        centerLat = parsedRequest.location.lat;
        centerLng = parsedRequest.location.lng;
      }
    } else if (parsedRequest.center) {
      centerLat = parsedRequest.center[0];
      centerLng = parsedRequest.center[1];
    }

    if (!isValidLatLng(centerLat, centerLng)) {
      const c = mapRef.current.getCenter();
      centerLat = c.lat;
      centerLng = c.lng;
    }

    const halfKm = parsedRequest.distance_to_edge || 2;
    const feat = createSquareFromCenter(centerLat, centerLng, halfKm);

    if (featureIdRef.current) {
      try { drawRef.current.delete(featureIdRef.current); } catch {}
      featureIdRef.current = null;
    }

    const created = drawRef.current.add(feat);
    if (created && created.length > 0) {
      featureIdRef.current = created[0];
      drawRef.current.changeMode("direct_select", { featureId: featureIdRef.current });
    }

    const bbox = feat.geometry.coordinates[0];
    const lats = bbox.map(c => c[1]), lngs = bbox.map(c => c[0]);
    mapRef.current.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 40 });

    if (onUpdateShape) onUpdateShape({ center: [centerLng, centerLat], distance_to_edge: halfKm });
  }, [parsedRequest]);

  // Force perfect square while dragging
  useEffect(() => {
    if (!drawRef.current || !mapRef.current) return;

    const handleUpdate = (e) => {
      const feat = e.features[0];
      if (!feat) return;

      // Only take first 4 vertices
      const coords = feat.geometry.coordinates[0].slice(0, 4);

      // Get center
      const centerLat = (Math.min(...coords.map(c => c[1])) + Math.max(...coords.map(c => c[1]))) / 2;
      const centerLng = (Math.min(...coords.map(c => c[0])) + Math.max(...coords.map(c => c[0]))) / 2;

      // Half side based on max distance from center
      const halfSideLat = Math.max(...coords.map(c => Math.abs(c[1] - centerLat)));
      const halfSideLng = Math.max(...coords.map(c => Math.abs(c[0] - centerLng)));
      const halfSide = Math.max(halfSideLat, halfSideLng);

      // Recompute square
      const newCoords = [
        [centerLng - halfSide, centerLat - halfSide],
        [centerLng + halfSide, centerLat - halfSide],
        [centerLng + halfSide, centerLat + halfSide],
        [centerLng - halfSide, centerLat + halfSide],
        [centerLng - halfSide, centerLat - halfSide], // close polygon
      ];

      drawRef.current.setFeatureCoordinates(feat.id, newCoords);

      if (onUpdateShape) onUpdateShape({ center: [centerLng, centerLat], distance_to_edge: halfSide * 111 });
    };

    mapRef.current.on("draw.update", handleUpdate);
    mapRef.current.on("draw.create", handleUpdate);

    return () => {
      mapRef.current.off("draw.update", handleUpdate);
      mapRef.current.off("draw.create", handleUpdate);
    };
  }, [onUpdateShape]);

  // Search suggestions
  const handleChange = async (e) => {
    const value = e.target.value;
    setQuery(value);
    if (!value) return setSuggestions([]);
    try {
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?autocomplete=true&limit=5&country=pk&access_token=${mapboxgl.accessToken}`);
      const data = await res.json();
      setSuggestions(data.features || []);
    } catch (err) { console.error(err); }
  };

  const handleSelect = (feature) => {
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
          {suggestions.map(f => (
            <li key={f.id} onClick={() => handleSelect(f)}>{f.place_name}</li>
          ))}
        </ul>
      )}
      <div ref={mapContainer} className="map-inner" />
    </div>
  );
}
