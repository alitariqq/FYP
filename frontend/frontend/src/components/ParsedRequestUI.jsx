import React from "react";
import "../styles/ParsedRequestUI.css";

export default function ParsedRequestUI({ parsedRequest, onConfirm, onReject }) {
  if (!parsedRequest) return null;

  const { study_type, location_name, is_timeseries, time_range, date_range_start, date_range_end } = parsedRequest;

  return (
    <div className="parsed-overlay">
      <div className="parsed-card">
        <h3>Confirm parsed request</h3>

        <div className="parsed-row"><strong>Study:</strong> <span>{study_type || "—"}</span></div>
        <div className="parsed-row"><strong>Location:</strong> <span>{location_name || "—"}</span></div>
        <div className="parsed-row"><strong>Time series:</strong> <span>{is_timeseries ? "Yes" : "No"}</span></div>
        {is_timeseries && (
          <div className="parsed-row">
            <strong>Range:</strong> <span>{time_range || `${date_range_start || ""} — ${date_range_end || ""}`}</span>
          </div>
        )}

        <p className="parsed-note">A square has been placed on the map. Drag to move it or drag any corner to resize. The square will always remain a perfect square.</p>

        <div className="parsed-actions">
          <button className="btn reject" onClick={onReject}>Reject</button>
          <button className="btn confirm" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
