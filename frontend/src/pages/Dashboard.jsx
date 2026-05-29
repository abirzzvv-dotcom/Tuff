import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../utils/api";
import { useAuth } from "../App";

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [tunnel, setTunnel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminStats, setAdminStats] = useState(null);

  useEffect(() => {
    Promise.all([
      api.projects.list().then((d) => setProjects(d.projects)).catch(() => {}),
      api.tunnel.status().then(setTunnel).catch(() => {}),
      user?.role === "admin"
        ? api.admin.stats().then(setAdminStats).catch(() => {})
        : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [user]);

  const running = projects.filter((p) => p.status === "running").length;
  const stopped = projects.filter((p) => p.status === "stopped").length;

  if (loading) {
    return (
      <div className="page">
        <div className="flex-center" style={{ height: 200 }}>
          <span className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="text-sm" style={{ marginTop: 4 }}>
            Welcome back, <strong>{user?.username}</strong>
            {!user?.is_verified && (
              <span className="badge badge-error" style={{ marginLeft: 8 }}>Email not verified</span>
            )}
          </p>
        </div>
        <Link to="/projects" className="btn btn-primary">+ New Project</Link>
      </div>

      {!user?.is_verified && (
        <div className="alert alert-warning" style={{ marginBottom: 24 }}>
          Your email is not verified. Some features are disabled.{" "}
          <button className="btn btn-sm btn-ghost" style={{ marginLeft: 8 }}
            onClick={() => api.auth.resendVerification().catch(() => {})}>
            Resend Code
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Projects</div>
          <div className="stat-value">{projects.length}</div>
          <div className="stat-sub">all projects</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Running</div>
          <div className="stat-value" style={{ color: "var(--success)" }}>{running}</div>
          <div className="stat-sub">active processes</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Stopped</div>
          <div className="stat-value" style={{ color: "var(--text3)" }}>{stopped}</div>
          <div className="stat-sub">inactive</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tunnel</div>
          <div className="stat-value" style={{ fontSize: "1.2rem", paddingTop: 6 }}>
            {tunnel?.connected ? (
              <span style={{ color: "var(--success)" }}>Active</span>
            ) : (
              <span style={{ color: "var(--danger)" }}>Offline</span>
            )}
          </div>
          <div className="stat-sub mono" style={{ fontSize: "0.72rem", wordBreak: "break-all" }}>
            {tunnel?.url || "no tunnel"}
          </div>
        </div>
      </div>

      {/* Admin stats */}
      {adminStats && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ marginBottom: 12 }}>Admin Overview</h2>
          <div className="grid-4">
            <div className="stat-card">
              <div className="stat-label">All Users</div>
              <div className="stat-value">{adminStats.totalUsers}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">All Projects</div>
              <div className="stat-value">{adminStats.totalProjects}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Running</div>
              <div className="stat-value" style={{ color: "var(--success)" }}>{adminStats.runningProjects}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Logs</div>
              <div className="stat-value">{adminStats.totalLogs.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Projects */}
      <div>
        <div className="page-header" style={{ marginBottom: 12 }}>
          <h2>Recent Projects</h2>
          <Link to="/projects" style={{ fontSize: "0.85rem" }}>View all →</Link>
        </div>

        {projects.length === 0 ? (
          <div className="card empty-state">
            <div className="icon">📁</div>
            <p>No projects yet.</p>
            <Link to="/projects" className="btn btn-primary" style={{ marginTop: 16 }}>Create your first project</Link>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.slice(0, 5).map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td><span className="badge badge-user">{p.type}</span></td>
                      <td>
                        <span className={`badge badge-${p.status === "running" ? "running" : "stopped"}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="text-muted text-sm">{new Date(p.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="flex gap-2">
                          <Link to={`/projects/${p.id}/editor`} className="btn btn-sm btn-ghost">Files</Link>
                          <Link to={`/projects/${p.id}/logs`} className="btn btn-sm btn-ghost">Logs</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Tunnel info */}
      {tunnel?.url && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3>Backend Tunnel</h3>
          <p style={{ marginTop: 8 }}>Your backend is publicly accessible at:</p>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <code style={{ fontSize: "0.9rem" }}>{tunnel.url}</code>
            <button className="btn btn-sm btn-ghost"
              onClick={() => navigator.clipboard.writeText(tunnel.url)}>
              Copy
            </button>
          </div>
          <p className="text-sm text-muted" style={{ marginTop: 8 }}>
            Set this as <code>VITE_API_URL</code> in your Vercel environment variables when it changes.
          </p>
        </div>
      )}
    </div>
  );
}
