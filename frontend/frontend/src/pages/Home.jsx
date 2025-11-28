import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Map from "../components/Map";
import FloatingButtons from "../components/FloatingButtons";
import GeminiPanel from "../components/GeminiPanel";

import api from "../api";
import logo from "../assets/logoText.png";
import "../styles/Home.css";

export default function Home() {
  const navigate = useNavigate();

  // Redirect to login if not authenticated
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) navigate("/login");
  }, [navigate]);

  // Maintian map query and suggestions state
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  // Maintain Gemini panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Maintain options dropdown state
  const [optionsOpen, setOptionsOpen] = useState(false);

  // Logout handler
  const handleLogout = async () => {
    try {
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) await api.post("/auth/logout/", { refresh });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      navigate("/login");
    }
  };

  // Gemini message send handler
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { sender: "user", text: input };
    setMessages([...messages, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await api.post("/queries/chat/", {
        messages: [...messages, userMessage].map((msg) => ({
          role: msg.sender,
          content: msg.text,
        })),
      });

      const geminiMessage = { sender: "gemini", text: response.data.reply };
      setMessages((prev) => [...prev, geminiMessage]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { sender: "gemini", text: "Error: Could not get response." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-container">
      <button
        className="site-logo-btn"
        onClick={() => (window.location.href = "/")}
      >
        <img src={logo} alt="MANZAR Logo" className="site-logo-img" />
      </button>

      <Map
        query={query}
        setQuery={setQuery}
        suggestions={suggestions}
        setSuggestions={setSuggestions}
      />

      <GeminiPanel
        panelOpen={panelOpen}
        setPanelOpen={setPanelOpen}
        messages={messages}
        input={input}
        setInput={setInput}
        handleSend={handleSend}
        loading={loading}
      />

      <FloatingButtons
        panelOpen={panelOpen}
        setPanelOpen={setPanelOpen}
        optionsOpen={optionsOpen}
        setOptionsOpen={setOptionsOpen}
        handleLogout={handleLogout}
      />
    </div>
  );
}
