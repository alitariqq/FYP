import axios from "axios";

// Helper function to refresh the access token
async function refreshToken() {
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) return null;

  try {
    const res = await axios.post("http://localhost:8000/api/token/refresh/", { refresh });
    const newAccess = res.data.access;
    localStorage.setItem("access_token", newAccess);
    return newAccess;
  } catch (err) {
    console.error("Refresh token failed:", err);
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    return null;
  }
}

// Create Axios instance
const api = axios.create({
  baseURL: "http://localhost:8000/api/", // your backend base URL
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle expired access tokens automatically
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true; // prevent infinite loops
      const newAccess = await refreshToken();
      if (newAccess) {
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest); // retry the original request
      }
    }

    return Promise.reject(error);
  }
);

export default api;
