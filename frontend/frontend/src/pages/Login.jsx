import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css';
import logo from '../assets/logoText.png';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.username || !form.password) {
      return alert("Username and password are required!");
    }

    try {
      const res = await axios.post('http://localhost:8000/api/login/', form);

      localStorage.setItem('access_token', res.data.access);
      localStorage.setItem('refresh_token', res.data.refresh);

      alert("Login successful!");
      navigate('/');
    } catch (err) {
      console.error(err);
      alert("Login failed! Check your credentials.");
    }
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <h1>Login</h1>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="text"
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <button type="submit">Login</button>
          <p className="signup-link">
            Don't have an account? <span onClick={() => navigate('/signup')}>Register Now!</span>
          </p>
        </form>
      </div>

      <div className="login-right">
        <img src={logo} alt="Logo" className="login-logo" />
      </div>
    </div>
  );
}
