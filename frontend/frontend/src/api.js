import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000/api/",
});


// =============================
// Refresh token helper
// =============================
async function refreshToken() {
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) return null;

  try {
    const res = await api.post("/token/refresh/", { refresh });

    const newAccess = res.data.access;

    localStorage.setItem("access_token", newAccess);

    return newAccess;
  } catch (err) {
    console.error("Refresh token failed:", err);

    return null;
  }
}


// =============================
// REQUEST → attach token
// =============================
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});


// =============================
// RESPONSE → auto refresh + logout
// =============================
api.interceptors.response.use(
  (res) => res,

  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const newAccess = await refreshToken();

      // ✅ refresh success → retry
      if (newAccess) {
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      }

      // 🚨 refresh failed → FORCE LOGOUT
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

      window.location.href = "/login";   // hard redirect
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;
