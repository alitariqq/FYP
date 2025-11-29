import React from "react";
import { useNavigate } from "react-router-dom";

import "../styles/RequestsHeader.css";
import logo from "../assets/logoText.png";
import optionsIcon from "../assets/options.png";

export default function RequestsHeader({ optionsOpen, setOptionsOpen, handleLogout }) {
  const navigate = useNavigate();

  return (
    <div className="requests-header">
      <button className="requests-logo-btn" onClick={() => navigate("/")}>
        <img src={logo} alt="MANZAR Logo" className="requests-logo-img" />
      </button>

      <button
        className="requests-options-btn"
        onClick={() => setOptionsOpen(!optionsOpen)}
      >
        <img src={optionsIcon} alt="Options" className="requests-options-icon" />
      </button>

      {optionsOpen && (
        <div className="requests-options-menu">
          <p onClick={() => alert("Notifications coming soon!")}>Notifications</p>
          <p onClick={() => navigate("/requests")}>Requests</p>
          <p onClick={() => alert("Account settings coming soon!")}>Account Settings</p>
          <p className="logout" onClick={handleLogout}>Logout</p>
        </div>
      )}
    </div>
  );
}
