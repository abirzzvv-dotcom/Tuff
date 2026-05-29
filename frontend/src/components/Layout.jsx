import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../App";
import { api } from "../utils/api";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tunnel, setTunnel] = useState(null);

  useEffect(() => {
    api.tunnel.status().then(setTunnel).catch(() => {});
    const id = setInterval(() => {
      api.tunnel.status().then(setTunnel).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = async () => {
    await api.auth.logout();
    logout();
  };

  const getTitle = () => {
    const p = location.pathname;
    if (p.includes("/editor")) return "File Editor";
    if (p.includes("/logs")) return "Logs Viewer";
    if (p.includes("/ai")) return "AI Assistant";
    if (p.startsWith("/projects")) return "Projects";
    if (p === "/dashboard") return "Dashboard";
    return "TermuxHost";
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span>🖥️</span> TermuxHost
        </div>

        <nav className="sidebar-nav">
          <div className="section-title">Navigation</div>
          <NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            <span className="icon">📊</span> Dashboard
          </NavLink>
          <NavLink to="/projects" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            <span className="icon">📁</span> Projects
          </NavLink>
          <NavLink to="/ai" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            <span className="icon">🤖</span> AI Assistant
          </NavLink>

          {user?.role === "admin" && (
            <>
              <div className="section-title" style={{ marginTop: 20 }}>Admin</div>
              <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                <span className="icon">🛡️</span> Admin Panel
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-name">{user?.username}</div>
            <div className="user-role">{user?.role} {user?.is_verified ? "✓" : "⚠ unverified"}</div>
          </div>
          <button className="nav-link" onClick={handleLogout} style={{ color: "var(--danger)" }}>
            <span className="icon">🚪</span> Logout
          </button>
        </div>
      </aside>

      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">{getTitle()}</span>
          <div className="tunnel-badge">
            <span className={`dot ${tunnel?.connected ? "green" : "red"}`} />
            {tunnel?.connected ? "Tunnel active" : "No tunnel"}
            {tunnel?.url && (
              <a href={tunnel.url} target="_blank" rel="noreferrer"
                style={{ fontSize: "0.75rem", color: "var(--accent)", marginLeft: 4 }}>
                {tunnel.url.replace("https://", "").slice(0, 28)}…
              </a>
            )}
          </div>
        </div>

        <Outlet />
      </div>
    </div>
  );
}
