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

  // Maintian map query and suggestions state
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  // Maintain Gemini panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Parsed request state (from Gemini PARSED { ... })
  const [parsedRequest, setParsedRequest] = useState(null);

  // Maintain options dropdown state
  const [optionsOpen, setOptionsOpen] = useState(false);

  // Track latest updated shape from map (center, distance_to_edge)
  const [editedShape, setEditedShape] = useState(null);

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
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await api.post("/queries/chat/", {
        messages: [...messages, userMessage].map((msg) => ({
          role: msg.sender,
          content: msg.text,
        })),
      });

      const replyText = response.data.reply || "";

      // Check for PARSED block at start of reply
      if (replyText.trim().startsWith("PARSED")) {
        // try to extract JSON block after the word PARSED
        const jsonMatch = replyText.match(/PARSED\s*([\s\S]*)/);
        if (jsonMatch && jsonMatch[1]) {
          let jsonText = jsonMatch[1].trim();

          // If the block begins with a code fence or ```json, strip it
          jsonText = jsonText.replace(/^```(?:json)?\s*/, "");
          jsonText = jsonText.replace(/```$/, "").trim();

          try {
            const parsed = JSON.parse(jsonText);
            setParsedRequest(parsed);
            // add a gemini message noting parsed result
            setMessages((prev) => [
              ...prev,
              { sender: "gemini", text: "Parsed request ready for confirmation." },
            ]);
          } catch (parseErr) {
            console.error("Failed to parse PARSED JSON:", parseErr);
            setMessages((prev) => [
              ...prev,
              { sender: "gemini", text: "Error: Gemini returned invalid PARSED JSON." },
            ]);
          }
        } else {
          setMessages((prev) => [
            ...prev,
            { sender: "gemini", text: "Error: PARSED block missing JSON." },
          ]);
        }
      } else {
        const geminiMessage = { sender: "gemini", text: replyText };
        setMessages((prev) => [...prev, geminiMessage]);
      }
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

  // Called by Map when user drags/resizes square
  const handleUpdateShape = (update) => {
    // update: { center: [lat, lng] OR [lng, lat], distance_to_edge: km }
    setEditedShape(update);
  };

  // User confirms parsed request. Merge editedShape into parsedRequest and submit to backend
  const handleConfirmParsed = async () => {
    if (!parsedRequest) return;

    const finalRequest = { ...parsedRequest };

    if (editedShape) {
      // ensure we store center as { lat, lng } and distance_to_edge in km
      const [lng, lat] = editedShape.center.length === 2 ? editedShape.center : [editedShape.center[1], editedShape.center[0]];
      finalRequest.location = { lat, lng };
      finalRequest.distance_to_edge = editedShape.distance_to_edge;
    }

    try {
      // example endpoint - replace with your real run endpoint
      await api.post("/queries/run/", finalRequest);
      setMessages((prev) => [...prev, { sender: "system", text: "Request submitted." }]);
      setParsedRequest(null);
      setEditedShape(null);
      // TODO: optionally navigate to results page
    } catch (err) {
      console.error("Run request failed:", err);
      setMessages((prev) => [...prev, { sender: "system", text: "Failed to submit request." }]);
    }
  };

  const handleRejectParsed = () => {
    setParsedRequest(null);
    setEditedShape(null);
    // keep messages; user can continue chatting
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
