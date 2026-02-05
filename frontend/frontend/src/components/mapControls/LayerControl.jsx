import { useState } from "react";
import "../../styles/MapControls.css";
import layersIcon from "../../assets/layers.png";

const STYLES = {
  Satellite: "mapbox://styles/mapbox/satellite-v9",
  Hybrid: "mapbox://styles/mapbox/satellite-streets-v12",
  Streets: "mapbox://styles/mapbox/streets-v12",
  Light: "mapbox://styles/mapbox/light-v11",
};

export default function LayerControl({ map }) {
  const [open, setOpen] = useState(false);

  const changeStyle = (style) => {
    if (!map) return;
    map.setStyle(style);
    setOpen(false);
  };

  return (
    <div className="layer-control">
      <button
        className="map-btn"
        onClick={() => setOpen((o) => !o)}
        title="Map Layers"
      >
        <img src={layersIcon} alt="Map Layers" className="location-icon" />
      </button>

      {open && (
        <div className="layer-menu">
          {Object.entries(STYLES).map(([name, style]) => (
            <button
              key={name}
              className="layer-option"
              onClick={() => changeStyle(style)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
