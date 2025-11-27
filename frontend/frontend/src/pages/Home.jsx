import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "./api"; // <- your centralized Axios instance

export default function Home() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]); // chat messages
  const [input, setInput] = useState(""); // current input
  const [loading, setLoading] = useState(false);

  // Check login on mount
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate("/login");
    }
  }, [navigate]);

  // Logout function
  const handleLogout = async () => {
    try {
      // Optionally call backend to blacklist refresh token
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        await api.post("/auth/logout/", { refresh });
      }
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      navigate("/login");
    }
  };

  // Send message to backend
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { sender: "user", text: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await api.post("/queries/chat/", {
        messages: updatedMessages.map((msg) => ({
          role: msg.sender,
          content: msg.text,
        })),
      });

      const geminiMessage = { sender: "gemini", text: response.data.reply };
      setMessages((prev) => [...prev, geminiMessage]);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 401) {
        // Token expired or invalid, force logout
        handleLogout();
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: "gemini", text: "Error: Could not get response." },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <div style={{ maxWidth: "600px", margin: "2rem auto", padding: "1rem" }}>
      <h1>Chat with Gemini</h1>
      <button
        onClick={handleLogout}
        style={{
          float: "right",
          padding: "0.3rem 0.5rem",
          borderRadius: "4px",
          border: "none",
          backgroundColor: "#dc3545",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        Logout
      </button>
      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: "8px",
          padding: "1rem",
          height: "400px",
          overflowY: "auto",
          marginBottom: "1rem",
          clear: "both",
        }}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              textAlign: msg.sender === "user" ? "right" : "left",
              margin: "0.5rem 0",
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "0.5rem 1rem",
                borderRadius: "12px",
                backgroundColor: msg.sender === "user" ? "#007bff" : "#e5e5ea",
                color: msg.sender === "user" ? "#fff" : "#000",
              }}
            >
              {msg.text}
            </span>
          </div>
        ))}
        {loading && <p>Gemini is typing...</p>}
      </div>

      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyPress}
        placeholder="Type your message..."
        style={{
          width: "80%",
          padding: "0.5rem",
          borderRadius: "4px",
          border: "1px solid #ccc",
        }}
      />
      <button
        onClick={handleSend}
        style={{
          width: "18%",
          marginLeft: "2%",
          padding: "0.5rem",
          borderRadius: "4px",
          border: "none",
          backgroundColor: "#007bff",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        Send
      </button>
    </div>
  );
}
