import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem("access_token");

  if (!token) return <Navigate to="/login" replace />;

  try {
    const decoded = jwtDecode(token);

    // expired
    if (decoded.exp * 1000 < Date.now()) {
      return <Navigate to="/login" replace />;
    }

    return children;
  } catch {
    return <Navigate to="/login" replace />;
  }
}
