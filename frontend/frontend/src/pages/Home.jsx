import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    // If user is not logged in → redirect to /login
    if (!token) {
      navigate("/login");
    }
  }, []);

  return <h1>Hello user</h1>;
}
