import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import "../styles/Map.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function Map({ query, setQuery, suggestions, setSuggestions, parsedRequest, onUpdateShape }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const featureIdRef = useRef(null);

  // Initialize map once
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

  // Draw / update square whenever parsedRequest changes
  useEffect(() => {
    if (!mapRef.current || !drawRef.current || !parsedRequest) return;

    // Remove old feature
    if (featureIdRef.current) {
      try { drawRef.current.delete(featureIdRef.current); } catch {}
      featureIdRef.current = null;
    }

    const [lat, lng] = parsedRequest.location || [31.41, 73.07];
    const distance = parsedRequest.distance_to_edge || 2;

    const latDelta = distance / 111;
    const lngDelta = distance / (111 * Math.cos((lat * Math.PI) / 180));

    const bl = [lng - lngDelta, lat - latDelta];
    const br = [lng + lngDelta, lat - latDelta];
    const tr = [lng + lngDelta, lat + latDelta];
    const tl = [lng - lngDelta, lat + latDelta];

    const square = {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [[bl, br, tr, tl, bl]] },
    };

    const created = drawRef.current.add(square);
    featureIdRef.current = created[0];

    drawRef.current.changeMode("direct_select", { featureId: featureIdRef.current });

    mapRef.current.fitBounds([[Math.min(...[bl[0], br[0], tr[0], tl[0]]), Math.min(...[bl[1], br[1], tr[1], tl[1]])],
                              [Math.max(...[bl[0], br[0], tr[0], tl[0]]), Math.max(...[bl[1], br[1], tr[1], tl[1]])]], 
                              { padding: 40 });

    onUpdateShape({ center: [lng, lat], distance_to_edge: distance });

  }, [parsedRequest]);

  // Enforce square while dragging
  useEffect(() => {
    if (!drawRef.current || !mapRef.current) return;

    const handleUpdate = e => {
      const feat = e.features[0];
      if (!feat) return;

      const coords = feat.geometry.coordinates[0].slice(0, 4);
      const centerLat = (Math.min(...coords.map(c => c[1])) + Math.max(...coords.map(c => c[1]))) / 2;
      const centerLng = (Math.min(...coords.map(c => c[0])) + Math.max(...coords.map(c => c[0]))) / 2;

      const halfSideLat = Math.max(...coords.map(c => Math.abs(c[1] - centerLat)));
      const halfSideLng = Math.max(...coords.map(c => Math.abs(c[0] - centerLng)));
      const halfSide = Math.max(halfSideLat, halfSideLng);

      const newCoords = [
        [centerLng - halfSide, centerLat - halfSide],
        [centerLng + halfSide, centerLat - halfSide],
        [centerLng + halfSide, centerLat + halfSide],
        [centerLng - halfSide, centerLat + halfSide],
        [centerLng - halfSide, centerLat - halfSide],
      ];

      drawRef.current.setFeatureCoordinates(feat.id, newCoords);
      onUpdateShape({ center: [centerLng, centerLat], distance_to_edge: halfSide * 111 });
    };

    mapRef.current.on("draw.update", handleUpdate);
    mapRef.current.on("draw.create", handleUpdate);

    return () => {
      mapRef.current.off("draw.update", handleUpdate);
      mapRef.current.off("draw.create", handleUpdate);
    };
  }, [onUpdateShape]);

  // Search suggestions
  const handleChange = async e => {
    const value = e.target.value;
    setQuery(value);
    if (!value) return setSuggestions([]);
    try {
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?autocomplete=true&limit=5&country=pk&access_token=${mapboxgl.accessToken}`);
      const data = await res.json();
      setSuggestions(data.features || []);
    } catch (err) { console.error(err); }
  };

  const handleSelect = feature => {
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
