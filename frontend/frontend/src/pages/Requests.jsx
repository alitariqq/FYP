import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";
import RequestsHeader from "../components/RequestsHeader";

import "../styles/Requests.css";

export default function Requests() {
  const navigate = useNavigate();

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) navigate("/login");
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const response = await api.get("/queries/my-requests/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) await api.post("/auth/logout/", { refresh });
    } catch (err) {
      console.error(err);
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      navigate("/login");
    }
  };

  // Filtering logic
  const filteredRequests = requests.filter(req => {
    const matchesFilter =
      filter === "All" ||
      (filter === "Processing" && req.status !== "FINISHED") ||
      (filter === "Ready" && req.status === "FINISHED");

    const matchesSearch =
      req.region_name.toLowerCase().includes(search.toLowerCase()) ||
      req.study_type.toLowerCase().includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="requests-container">
      <RequestsHeader
        optionsOpen={optionsOpen}
        setOptionsOpen={setOptionsOpen}
        handleLogout={handleLogout}
      />

      <div className="requests-wrapper">
        {/* Search + Filters */}
        <div className="requests-header-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Search requests..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <div className="filter-buttons">
            <button
              className={`filter-btn ${filter === "All" ? "active" : ""}`}
              onClick={() => setFilter("All")}
            >
              All
            </button>

            <button
              className={`filter-btn ${filter === "Processing" ? "active" : ""}`}
              onClick={() => setFilter("Processing")}
            >
              Processing
            </button>

            <button
              className={`filter-btn ${filter === "Ready" ? "active" : ""}`}
              onClick={() => setFilter("Ready")}
            >
              Ready
            </button>
          </div>
        </div>

        {/* Table wrapper */}
        <div className="table-container">
          {filteredRequests.length === 0 ? (
            <p className="no-requests">No matching requests.</p>
          ) : (
            <table className="requests-table-modern">
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Study Type</th>
                  <th>Date Submitted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredRequests.map(req => (
                  <tr key={req.request_id}>
                    <td>{req.region_name}</td>
                    <td>{req.study_type}</td>
                    <td>{new Date(req.submitted_at).toLocaleDateString()}</td>

                    <td>
                      <span
                        className={`status-badge ${
                          req.status === "FINISHED"
                            ? "status-ready"
                            : "status-processing"
                        }`}
                      >
                        {req.status === "FINISHED" ? "Ready" : "Processing"}
                      </span>
                    </td>

                    <td>
                      <button
                        className={
                          req.status === "FINISHED"
                            ? "view-btn"
                            : "view-btn disabled"
                        }
                        disabled={req.status !== "FINISHED"}
                        onClick={() =>
                          req.status === "FINISHED" &&
                          navigate(`/requests/${req.request_id}`)
                        }
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
