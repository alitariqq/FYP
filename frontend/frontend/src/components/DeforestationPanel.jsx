import "../styles/DeforestationPanel.css";
import { useEffect, useState } from "react";

export default function DeforestationPanel({ panelOpen, setPanelOpen, result }) {
  if (!result) return null;

  const {
    metrics_json,
    mask_colormap_path,
    mask_path,
    before_image_path,
    after_image_path,
  } = result;

  // -----------------------------
  // Parse metrics safely
  // -----------------------------
  let parsedMetrics = null;
  if (metrics_json) {
    try {
      parsedMetrics =
        typeof metrics_json === "string" ? JSON.parse(metrics_json) : metrics_json;
    } catch (err) {
      console.error("Failed to parse metrics_json:", err, metrics_json);
    }
  }

  const BACKEND_URL = "http://localhost:8000/media"; // or use env variable

  const maskUrl = (mask_colormap_path || mask_path)
    ? `${BACKEND_URL}/${mask_colormap_path || mask_path}`
    : null;


  return (
    <div className={`deforestation-panel ${panelOpen ? "open" : ""}`}>
      {panelOpen && (
        <button
          className="deforestation-close-btn"
          onClick={() => setPanelOpen(false)}
        >
          ×
        </button>
      )}

      <div className="deforestation-header">
        <h3>Deforestation Analysis</h3>
      </div>

      <div className="deforestation-content">
        {/* MASK */}
        {maskUrl ? (
          <div className="deforestation-map-placeholder">
            <p>Detected Deforestation Areas (preview)</p>
            <img
              src={maskUrl}
              alt="Mask overlay"
              className="deforestation-mask-image"
            />
          </div>
        ) : (
          <p>No mask available.</p>
        )}

        {/* METRICS */}
        {parsedMetrics ? (
          <MetricsRenderer metrics={parsedMetrics} />
        ) : (
          <p>No metrics available.</p>
        )}
      </div>
    </div>
  );
}

// ----------------------
// Metrics Renderer
// ----------------------
function MetricsRenderer({ metrics }) {
  const SECTIONS = [
    { key: "summary", title: "Summary", color: "#4a90e2" },
    { key: "infographics", title: "Infographic Estimates", color: "#50c878" },
    { key: "environmental_impact", title: "Environmental Impact", color: "#3ca55c" },
    { key: "economic_impact", title: "Economic Impact", color: "#e6a700" },
    { key: "action_plan", title: "Action Plan", color: "#9b59b6" },
  ];

  return (
    <div className="metrics-container">
      {SECTIONS.map(
        (section) =>
          metrics[section.key] && (
            <div key={section.key} className="metrics-section">
              <h4>{section.title}</h4>
              <div className="metrics-grid">
                {Object.entries(metrics[section.key]).map(([name, val]) => (
                  <MetricCard
                    key={name}
                    name={name}
                    value={val}
                    color={section.color}
                  />
                ))}
              </div>
            </div>
          )
      )}
    </div>
  );
}

// ----------------------
// Metric Card
// ----------------------
function MetricCard({ name, value, color }) {
  const [display, setDisplay] = useState(
    typeof value === "number" ? 0 : value
  );

  useEffect(() => {
    if (typeof value !== "number") return; // skip animation for strings

    let start = 0;
    const end = value;
    const duration = 800;
    const increment = end / (duration / 16);

    const interval = setInterval(() => {
      start += increment;
      if (start >= end) {
        start = end;
        clearInterval(interval);
      }
      setDisplay(Math.round(start));
    }, 16);

    return () => clearInterval(interval);
  }, [value]);

  const formattedLabel = name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="metric-card" style={{ borderLeft: `6px solid ${color}` }}>
      <div className="metric-label">{formattedLabel}</div>
      <div className="metric-value">
        {typeof value === "number" ? display.toLocaleString() : value}
      </div>
    </div>
  );
}
