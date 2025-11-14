import { useState } from 'react';
import axios from 'axios';

export default function Signup() {
  const [form, setForm] = useState({ username: '', email: '', password: '' });

  const handleSubmit = async (e) => {
  e.preventDefault();

  if (!form.email) return alert("Email is required!");

  try {
    const res = await axios.post(
      'http://localhost:8000/api/register/',
      form,
      { withCredentials: true }  // only needed if using cookies
    );

    console.log(res.data);
    alert("User registered successfully!");
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
    alert("Registration failed");
  }
};

  return (
    <form onSubmit={handleSubmit}>
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
    </form>
  );
}
