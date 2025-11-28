import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "../styles/Map.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function Map({ query, setQuery, suggestions, setSuggestions }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  // Initialize map
  useEffect(() => {
    if (mapRef.current) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-v9",
      center: [73.07, 31.41],
      zoom: 9,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl());
  }, []);

  const handleChange = async (e) => {
    const value = e.target.value;
    setQuery(value);

    if (!value) {
      setSuggestions([]);
      return;
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      value
    )}.json?autocomplete=true&limit=5&country=pk&access_token=${mapboxgl.accessToken}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      setSuggestions(data.features || []);
    } catch (err) {
      console.error("Autocomplete failed", err);
    }
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
          {suggestions.map((feature) => (
            <li key={feature.id} onClick={() => handleSelect(feature)}>
              {feature.place_name}
            </li>
          ))}
        </ul>
      )}

      <div ref={mapContainer} className="map-inner" />
    </div>
  );
}
