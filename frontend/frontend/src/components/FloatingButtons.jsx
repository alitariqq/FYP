import React from "react";
import "../styles/FloatingButtons.css";
import geminiLogo from "../assets/gemini_logo.png";
import optionsIcon from "../assets/options.png";
import { useNavigate } from "react-router-dom";

export default function FloatingButtons({ 
  panelOpen,
  setPanelOpen,
  optionsOpen,
  setOptionsOpen,
  handleLogout,
  deforestationPanelOpen
}) {

  const navigate = useNavigate();

  return (
    !panelOpen && !deforestationPanelOpen && (
      <div className="floating-buttons">
        <button className="gemini-toggle-btn" onClick={() => setPanelOpen(true)}>
          <img src={geminiLogo} alt="Gemini" className="gemini-logo-btn" />
        </button>

        <button className="options-btn" onClick={() => setOptionsOpen(!optionsOpen)}>
          <img src={optionsIcon} alt="Options" className="options-icon" />
        </button>

        {optionsOpen && (
          <div className="options-menu">
            <p onClick={() => alert("Notifications coming soon!")}>Notifications</p>
            <p onClick={() => navigate("/requests")}>Requests</p>
            <p onClick={() => alert("Account settings coming soon!")}>Account Settings</p>
            <p className="logout" onClick={handleLogout}>Logout</p>
          </div>
        )}
      </div>
    )
  );
}
