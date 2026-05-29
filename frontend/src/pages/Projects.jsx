import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../utils/api";

const PROJECT_TYPES = [
  { value: "nodejs", label: "Node.js" },
  { value: "python", label: "Python" },
  { value: "api", label: "REST API (Node.js)" },
  { value: "websocket", label: "WebSocket Server" },
  { value: "discord-node", label: "Discord Bot (Node.js)" },
  { value: "discord-python", label: "Discord Bot (Python)" },
];

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showInstall, setShowInstall] = useState(null);
  const [form, setForm] = useState({ name: "", type: "nodejs", description: "", entryFile: "", port: "" });
  const [installForm, setInstallForm] = useState({ runtime: "npm", packages: "" });
  const [installResult, setInstallResult] = useState("");

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const data = await api.projects.list();
      setProjects(data.projects);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      const payload = { ...form, port: form.port ? parseInt(form.port) : undefined };
      await api.projects.create(payload);
      setShowCreate(false);
      setForm({ name: "", type: "nodejs", description: "", entryFile: "", port: "" });
      loadProjects();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAction(id, action) {
    setActionLoading((prev) => ({ ...prev, [`${id}-${action}`]: true }));
    try {
      if (action === "start") await api.projects.start(id);
      else if (action === "stop") await api.projects.stop(id);
      else if (action === "restart") await api.projects.restart(id);
      else if (action === "delete") {
        if (!confirm("Delete this project and all its files? This cannot be undone.")) return;
        await api.projects.delete(id);
      }
      loadProjects();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading((prev) => ({ ...prev, [`${id}-${action}`]: false }));
    }
  }

  async function handleInstall(e) {
    e.preventDefault();
    setInstallResult("Installing...");
    try {
      const pkgs = installForm.packages.split(/[\s,]+/).filter(Boolean);
      let result;
      if (installForm.runtime === "npm") {
        result = await api.projects.installNpm(showInstall, pkgs);
      } else {
        result = await api.projects.installPip(showInstall, pkgs);
      }
      setInstallResult(result.output || "Done");
    } catch (err) {
      setInstallResult("Error: " + err.message);
    }
  }

  const isLoading = (id, action) => actionLoading[`${id}-${action}`];

  if (loading) return <div className="page"><div className="flex-center" style={{ height: 200 }}><span className="spinner" /></div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Projects</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Project</button>
      </div>

      {error && <div className="alert alert-error" onClick={() => setError("")}>{error} ✕</div>}

      {projects.length === 0 ? (
        <div className="card empty-state">
          <div className="icon">📁</div>
          <p>No projects yet. Create your first one!</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}>
            Create Project
          </button>
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
                  <th>Port</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div><strong>{p.name}</strong></div>
                      {p.description && <div className="text-xs text-muted">{p.description}</div>}
                    </td>
                    <td><span className="badge badge-user">{p.type}</span></td>
                    <td>
                      <span className={`badge badge-${p.status === "running" ? "running" : p.status === "error" ? "error" : "stopped"}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="mono text-sm">{p.port || "—"}</td>
                    <td className="text-muted text-sm">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                        {p.status !== "running" ? (
                          <button className="btn btn-sm btn-success" onClick={() => handleAction(p.id, "start")}
                            disabled={isLoading(p.id, "start")}>
                            {isLoading(p.id, "start") ? <span className="spinner" /> : "▶ Start"}
                          </button>
                        ) : (
                          <>
                            <button className="btn btn-sm btn-danger" onClick={() => handleAction(p.id, "stop")}
                              disabled={isLoading(p.id, "stop")}>
                              {isLoading(p.id, "stop") ? <span className="spinner" /> : "■ Stop"}
                            </button>
                            <button className="btn btn-sm btn-ghost" onClick={() => handleAction(p.id, "restart")}
                              disabled={isLoading(p.id, "restart")}>
                              {isLoading(p.id, "restart") ? <span className="spinner" /> : "↺ Restart"}
                            </button>
                          </>
                        )}
                        <Link to={`/projects/${p.id}/editor`} className="btn btn-sm btn-ghost">Files</Link>
                        <Link to={`/projects/${p.id}/logs`} className="btn btn-sm btn-ghost">Logs</Link>
                        <button className="btn btn-sm btn-ghost" onClick={() => { setShowInstall(p.id); setInstallResult(""); }}>
                          Packages
                        </button>
                        <Link to={`/projects/${p.id}/ai`} className="btn btn-sm btn-ghost">AI</Link>
                        <button className="btn btn-sm btn-danger" onClick={() => handleAction(p.id, "delete")}
                          disabled={isLoading(p.id, "delete")}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal title="New Project" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input type="text" className="form-input" placeholder="My Awesome Bot"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Type *</label>
              <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {PROJECT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input type="text" className="form-input" placeholder="Optional description"
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Entry File</label>
                <input type="text" className="form-input mono" placeholder="index.js"
                  value={form.entryFile} onChange={(e) => setForm({ ...form, entryFile: e.target.value })} />
              </div>
              <div className="form-group" style={{ width: 120 }}>
                <label className="form-label">Port</label>
                <input type="number" className="form-input" placeholder="3000"
                  value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Project</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Install Packages Modal */}
      {showInstall && (
        <Modal title="Install Packages" onClose={() => setShowInstall(null)}>
          <form onSubmit={handleInstall}>
            <div className="form-group">
              <label className="form-label">Package Manager</label>
              <select className="form-select" value={installForm.runtime}
                onChange={(e) => setInstallForm({ ...installForm, runtime: e.target.value })}>
                <option value="npm">npm (Node.js)</option>
                <option value="pip">pip (Python)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Packages (space or comma separated)</label>
              <input type="text" className="form-input mono" placeholder="express axios dotenv"
                value={installForm.packages} onChange={(e) => setInstallForm({ ...installForm, packages: e.target.value })} required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>Install</button>
          </form>
          {installResult && (
            <pre style={{ marginTop: 16, maxHeight: 200, overflow: "auto", fontSize: "0.8rem" }}>{installResult}</pre>
          )}
        </Modal>
      )}
    </div>
  );
}
