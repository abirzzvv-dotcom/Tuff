import React, { useState, useEffect, createContext, useContext } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import FileEditor from "./pages/FileEditor";
import Logs from "./pages/Logs";
import AIAssistant from "./pages/AIAssistant";
import { getUser, getToken } from "./utils/api";

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user || !getToken()) return <Navigate to="/login" replace />;
  return children;
}

function RequireGuest({ children }) {
  const { user } = useAuth();
  if (user && getToken()) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(() => getUser());
  const navigate = useNavigate();

  const login = (userData) => setUser(userData);
  const logout = () => {
    setUser(null);
    navigate("/login");
  };

  useEffect(() => {
    if (!getToken()) setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <Routes>
        <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />
        <Route path="/register" element={<RequireGuest><Register /></RequireGuest>} />

        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId/editor" element={<FileEditor />} />
          <Route path="/projects/:projectId/logs" element={<Logs />} />
          <Route path="/ai" element={<AIAssistant />} />
          <Route path="/projects/:projectId/ai" element={<AIAssistant />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}
