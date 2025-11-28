import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/Signup.css';
import logo from '../assets/logoText.png';

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email) return alert("Email is required!");

    try {
      const res = await axios.post(
        'http://localhost:8000/api/register/',
        form,
        { withCredentials: true }
      );
      console.log(res.data);
      alert("User registered successfully!");
      navigate('/login');
    } catch (err) {
      console.error(err.response ? err.response.data : err.message);
      alert("Registration failed");
    }
  };

  return (
    <div className="signup-container">
      <div className="left-side">
        <img src={logo} alt="Logo" className="logo" />
      </div>
      <div className="right-side">
        <form className="signup-form" onSubmit={handleSubmit}>
          <h2>Register</h2>
          <input
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <button type="submit">Sign Up</button>
          <p className="login-link">
            Already have an account? <span onClick={() => navigate('/login')}>Login</span>
          </p>
        </form>
      </div>
    </div>
  );
}
