import { useState } from "react";
import "../styles/ManualRequestPanel.css";
import logo from "../assets/logoText.png";

export default function ManualRequestPanel({
    panelOpen,
    setPanelOpen,
    formData,
    onFormChange,
    onSubmit,
    submitted,
    onNewRequest,
    onRelocate,
}) {
    const [submitting, setSubmitting] = useState(false);

    const handleChange = (field, value) => {
        onFormChange({ ...formData, [field]: value });
    };

    const handleStudyTypeChange = (value) => {
        const updates = { studyType: value };
        if (value === "deforestation") {
            updates.isTimeseries = false;
            updates.intervalLength = 0;
        }
        onFormChange({ ...formData, ...updates });
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await onSubmit();
        } finally {
            setSubmitting(false);
        }
    };

    const showDateEnd =
        formData.studyType === "deforestation" ||
        (formData.studyType === "lulc" && formData.isTimeseries);

    const showTimeseries = formData.studyType === "lulc";
    const showInterval = formData.studyType === "lulc" && formData.isTimeseries;

    return (
        <div className={`manual-panel ${panelOpen ? "open" : ""}`}>
            {panelOpen && (
                <button
                    className="manual-panel-close-btn"
                    onClick={() => setPanelOpen(false)}
                >
                    ×
                </button>
            )}

            {submitted ? (
                <div className="manual-panel-submitted">
                    <img src={logo} alt="MANZAR" className="manual-panel-submitted-logo" />
                    <h3>Your request has been submitted!</h3>
                    <p>You will be notified when processing is complete.</p>
                    <div className="manual-panel-submitted-actions">
                        <button className="manual-btn primary" onClick={onNewRequest}>
                            New Request
                        </button>
                        <button
                            className="manual-btn secondary"
                            onClick={() => setPanelOpen(false)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="manual-panel-header">
                        <h2>New Request</h2>
                        <p className="manual-panel-subtitle">
                            Configure your satellite imagery analysis
                        </p>
                    </div>

                    <div className="manual-panel-form">
                        {/* Location Name */}
                        <div className="manual-field">
                            <label>Location Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Amazon Rainforest"
                                value={formData.locationName}
                                onChange={(e) => handleChange("locationName", e.target.value)}
                            />
                        </div>

                        {/* Study Type */}
                        <div className="manual-field">
                            <label>Study Type</label>
                            <select
                                value={formData.studyType}
                                onChange={(e) => handleStudyTypeChange(e.target.value)}
                            >
                                <option value="deforestation">Deforestation</option>
                                <option value="lulc">LULC</option>
                            </select>
                        </div>

                        {/* Date Range Start */}
                        <div className="manual-field">
                            <label>Date Range Start</label>
                            <input
                                type="date"
                                value={formData.dateRangeStart}
                                onChange={(e) => handleChange("dateRangeStart", e.target.value)}
                            />
                        </div>

                        {/* Date Range End — visible for deforestation always, LULC only if timeseries */}
                        {showDateEnd && (
                            <div className="manual-field">
                                <label>Date Range End</label>
                                <input
                                    type="date"
                                    value={formData.dateRangeEnd}
                                    onChange={(e) => handleChange("dateRangeEnd", e.target.value)}
                                />
                            </div>
                        )}

                        {/* Time Series checkbox — LULC only */}
                        {showTimeseries && (
                            <div className="manual-field checkbox-field">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={formData.isTimeseries}
                                        onChange={(e) =>
                                            handleChange("isTimeseries", e.target.checked)
                                        }
                                    />
                                    <span>Time Series Study</span>
                                </label>
                            </div>
                        )}

                        {/* Interval Length — LULC timeseries only */}
                        {showInterval && (
                            <div className="manual-field">
                                <label>Interval Length (Years)</label>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={formData.intervalLength}
                                    onChange={(e) =>
                                        handleChange("intervalLength", parseInt(e.target.value) || 0)
                                    }
                                />
                            </div>
                        )}

                        <div className="manual-field-divider" />

                        {/* Relocate to map center */}
                        <button
                            type="button"
                            className="manual-btn relocate-btn"
                            onClick={onRelocate}
                        >
                            ⊕ Move to Current Map Location
                        </button>

                        {/* Latitude */}
                        <div className="manual-field">
                            <label>Latitude</label>
                            <input
                                type="number"
                                step="any"
                                placeholder="Auto-filled from map"
                                value={formData.latitude}
                                onChange={(e) =>
                                    handleChange("latitude", parseFloat(e.target.value) || 0)
                                }
                            />
                        </div>

                        {/* Longitude */}
                        <div className="manual-field">
                            <label>Longitude</label>
                            <input
                                type="number"
                                step="any"
                                placeholder="Auto-filled from map"
                                value={formData.longitude}
                                onChange={(e) =>
                                    handleChange("longitude", parseFloat(e.target.value) || 0)
                                }
                            />
                        </div>

                        {/* Distance to Edge */}
                        <div className="manual-field">
                            <label>Distance to Edge (meters)</label>
                            <input
                                type="number"
                                min="100"
                                step="100"
                                placeholder="2000"
                                value={formData.distanceToEdge}
                                onChange={(e) =>
                                    handleChange(
                                        "distanceToEdge",
                                        parseInt(e.target.value) || 2000
                                    )
                                }
                            />
                        </div>
                    </div>

                    <div className="manual-panel-footer">
                        <button
                            className="manual-btn submit"
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? "Submitting..." : "Submit Request"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
