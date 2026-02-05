import "../../styles/MapControls.css";
import LayerControl from "./LayerControl";
import locationsIcon from "../../assets/Location.png";

export default function MapControls({ map }) {
  const zoomIn = () => map?.zoomIn();
  const zoomOut = () => map?.zoomOut();

  const goToLocation = () => {
    if (!map || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      map.flyTo({
        center: [longitude, latitude],
        zoom: 14,
      });
    });
  };

  return (
    <div className="map-controls-container">

      <LayerControl map={map} />

      <button className="map-btn" onClick={goToLocation} title="My Location">
        <img src={locationsIcon} alt="My Location" className="location-icon" />
      </button>

      <button className="map-btn" onClick={zoomIn} title="Zoom In">
        +
      </button>

      <button className="map-btn" onClick={zoomOut} title="Zoom Out">
        −
      </button>

    </div>
  );
}
