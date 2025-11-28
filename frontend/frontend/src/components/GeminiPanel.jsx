import "../styles/GeminiPanel.css";
import sendArrow from "../assets/send.png";
import geminiLogo from "../assets/gemini_logo.png";
import logo from "../assets/logoText.png";

export default function GeminiPanel({
  panelOpen,
  setPanelOpen,
  messages,
  input,
  setInput,
  handleSend,
  loading,
}) {
  const handleKeyPress = (e) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <div className={`gemini-panel ${panelOpen ? "open" : ""}`}>
      {panelOpen && (
        <button className="gemini-close-btn" onClick={() => setPanelOpen(false)}>
          ×
        </button>
      )}

      <div className="gemini-header">
        <img src={geminiLogo} alt="Gemini" className="gemini-logo-header" />
      </div>

      {messages.length === 0 && (
        <div className="gemini-welcome">
          <img src={logo} alt="Site Logo" className="gemini-welcome-logo" />
          <h2>Start Your Query</h2>
          <p>Request Satellite Imagery Analysis for Any Location.</p>
        </div>
      )}

      <div className="gemini-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`gemini-msg ${msg.sender}`}>
            {msg.text}
          </div>
        ))}
        {loading && <div className="gemini-msg gemini">Gemini is typing...</div>}
      </div>

      <div className="gemini-input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type a message..."
          className="gemini-textarea"
        />
        <button className="gemini-send-btn" onClick={handleSend}>
          <img src={sendArrow} alt="Send" />
        </button>
      </div>
    </div>
  );
}
