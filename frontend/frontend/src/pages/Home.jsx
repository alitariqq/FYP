import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Map from "../components/Map";
import FloatingButtons from "../components/FloatingButtons";
import GeminiPanel from "../components/GeminiPanel";
import ParsedRequestUI from "../components/ParsedRequestUI";

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

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsedRequest, setParsedRequest] = useState(null);
  const [editedShape, setEditedShape] = useState(null);
  const [optionsOpen, setOptionsOpen] = useState(false);

  // Logout handler
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

  // Send message to Gemini
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { sender: "user", text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await api.post("/queries/chat/", {
        messages: [...messages, userMessage].map(m => ({
          role: m.sender,
          content: m.text,
        })),
      });

      const replyText = response.data.reply || "";

      if (replyText.trim().startsWith("PARSED")) {
        const jsonMatch = replyText.match(/PARSED\s*([\s\S]*)/);
        if (jsonMatch && jsonMatch[1]) {
          let jsonText = jsonMatch[1].trim();
          jsonText = jsonText.replace(/^```(?:json)?\s*/, "").replace(/```$/, "").trim();

          try {
            const parsed = JSON.parse(jsonText);
            setParsedRequest(parsed);
            setEditedShape(null);
            setMessages(prev => [
              ...prev,
              { sender: "gemini", text: "Parsed request ready for confirmation." },
            ]);
          } catch {
            setMessages(prev => [
              ...prev,
              { sender: "gemini", text: "Error: Gemini returned invalid PARSED JSON." },
            ]);
          }
        }
      } else {
        setMessages(prev => [...prev, { sender: "gemini", text: replyText }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { sender: "gemini", text: "Error: Could not get response." }]);
    } finally {
      setLoading(false);
    }
  };

  // Map updates shape
  const handleUpdateShape = update => setEditedShape(update);

  // Confirm parsed request
  const handleConfirmParsed = async () => {
    if (!parsedRequest) return;

    const finalRequest = { ...parsedRequest };

    if (editedShape) {
      const [lng, lat] = editedShape.center;
      finalRequest.latitude = lat;
      finalRequest.longitude = lng;
      finalRequest.distance_to_edge = editedShape.distance_to_edge;
    } else if (parsedRequest.location) {
      finalRequest.latitude = parsedRequest.location[0];
      finalRequest.longitude = parsedRequest.location[1];
    }

    finalRequest.region_name = parsedRequest.location_name || parsedRequest.region_name;
    finalRequest.study_type = parsedRequest.study_type;
    finalRequest.is_timeseries = parsedRequest.is_timeseries || false;
    finalRequest.date_range_start = parsedRequest.date_range_start;
    finalRequest.date_range_end = parsedRequest.date_range_end;
    finalRequest.interval_length = parsedRequest.interval_length || 0;
    delete finalRequest.location;

    try {
      const token = localStorage.getItem("access_token");
      await api.post("/queries/parsed-request/", finalRequest, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessages(prev => [...prev, { sender: "system", text: "Request submitted successfully." }]);
      setParsedRequest(null);
      setEditedShape(null);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { sender: "system", text: "Failed to submit request." }]);
    }
  };

  const handleRejectParsed = () => {
    setParsedRequest(null);
    setEditedShape(null);
  };

  return (
    <div className="home-container">
      <button className="site-logo-btn" onClick={() => (window.location.href = "/")}>
        <img src={logo} alt="MANZAR Logo" className="site-logo-img" />
      </button>

      <Map
        key={parsedRequest ? JSON.stringify(parsedRequest.location) : "no-parsed"}
        query={query}
        setQuery={setQuery}
        suggestions={suggestions}
        setSuggestions={setSuggestions}
        parsedRequest={parsedRequest}
        onUpdateShape={handleUpdateShape}
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

      {parsedRequest && (
        <ParsedRequestUI
          parsedRequest={parsedRequest}
          onConfirm={handleConfirmParsed}
          onReject={handleRejectParsed}
        />
      )}
    </div>
  );
}
