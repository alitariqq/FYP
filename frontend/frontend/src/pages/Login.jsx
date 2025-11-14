import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.username || !form.password) {
      return alert("Username and password are required!");
    }

    try {
      // Make API request to Django JWT login endpoint
      const res = await axios.post('http://localhost:8000/api/login/', form);

      // Save tokens in localStorage (or sessionStorage)
      localStorage.setItem('access_token', res.data.access);
      localStorage.setItem('refresh_token', res.data.refresh);

      alert("Login successful!");
      navigate('/'); // Redirect to homepage after login
    } catch (err) {
      console.error(err);
      alert("Login failed! Check your credentials.");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
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
    </form>
  );
}
