import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../utils/api";

export default function Logs() {
  const { projectId } = useParams();
  const [logs, setLogs] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [limit, setLimit] = useState(100);
  const bottomRef = useRef(null);

  useEffect(() => {
    api.projects.get(projectId).then((d) => setProject(d.project)).catch(() => {});
    loadLogs();
  }, [projectId, limit]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(loadLogs, 3000);
    return () => clearInterval(id);
  }, [autoRefresh, limit, projectId]);

  useEffect(() => {
    if (autoRefresh) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function loadLogs() {
    try {
      const data = await api.projects.getLogs(projectId, limit);
      setLogs(data.logs.reverse());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Logs</h1>
          <p className="text-sm" style={{ marginTop: 4 }}>
            {project ? <><strong>{project.name}</strong> — <span className={`badge badge-${project.status === "running" ? "running" : "stopped"}`}>{project.status}</span></> : "Loading…"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/projects/${projectId}/editor`} className="btn btn-ghost">Files</Link>
          <Link to={`/projects/${projectId}/ai`} className="btn btn-ghost">AI</Link>
          <button className="btn btn-ghost" onClick={loadLogs}>↻ Refresh</button>
          <button
            className={`btn ${autoRefresh ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setAutoRefresh(!autoRefresh)}>
            {autoRefresh ? "● Live" : "○ Live"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label className="form-label" style={{ margin: 0 }}>Show last:</label>
          {[50, 100, 200, 500].map((n) => (
            <button key={n} className={`btn btn-sm ${limit === n ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setLimit(n)}>{n}</button>
          ))}
          {project?.status !== "running" && (
            <button className="btn btn-sm btn-success" style={{ marginLeft: "auto" }}
              onClick={() => api.projects.start(projectId).then(() => window.location.reload())}>
              ▶ Start Project
            </button>
          )}
          {project?.status === "running" && (
            <>
              <button className="btn btn-sm btn-danger" style={{ marginLeft: "auto" }}
                onClick={() => api.projects.stop(projectId).then(() => window.location.reload())}>
                ■ Stop
              </button>
              <button className="btn btn-sm btn-ghost"
                onClick={() => api.projects.restart(projectId).then(() => window.location.reload())}>
                ↺ Restart
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex-center" style={{ height: 200 }}><span className="spinner" /></div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📋</div>
          <p>No logs yet. Start your project to see output.</p>
        </div>
      ) : (
        <div className="log-container">
          {logs.map((log) => (
            <div className="log-line" key={log.id || log.created_at}>
              <span className="log-time">{formatTime(log.created_at)}</span>
              <span className={`log-text ${log.log_type === "error" ? "error" : "info"}`}>
                {log.content}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {autoRefresh && (
        <p className="text-xs text-muted" style={{ marginTop: 8, textAlign: "center" }}>
          Auto-refreshing every 3 seconds…
        </p>
      )}
    </div>
  );
}
