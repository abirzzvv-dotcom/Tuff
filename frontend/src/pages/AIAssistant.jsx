import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../utils/api";

export default function AIAssistant() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(projectId || "");
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api.projects.list().then((d) => setProjects(d.projects)).catch(() => {});
    if (projectId) {
      api.projects.get(projectId).then((d) => setProject(d.project)).catch(() => {});
    }
    loadHistory();
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadHistory() {
    try {
      const data = await api.ai.history(projectId || null, 50);
      const formatted = data.history.flatMap((h) => [
        { role: "user", content: h.message, id: h.id + "-user", time: h.created_at },
        { role: "ai", content: h.response, id: h.id + "-ai", time: h.created_at },
      ]);
      setMessages(formatted);
    } catch {}
  }

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text, id: Date.now() + "-user", time: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const data = await api.ai.chat(text, selectedProject || null);
      const aiMsg = {
        role: "ai",
        content: data.response,
        id: Date.now() + "-ai",
        time: new Date().toISOString(),
        actions: data.actions,
        actionResults: data.actionResults,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }

  async function handleClear() {
    if (!confirm("Clear AI chat history?")) return;
    await api.ai.clearHistory(selectedProject || null).catch(() => {});
    setMessages([]);
  }

  function handleProjectChange(id) {
    setSelectedProject(id);
    if (id) navigate(`/projects/${id}/ai`);
    else navigate("/ai");
    setMessages([]);
    api.ai.history(id || null, 50).then((d) => {
      const formatted = d.history.flatMap((h) => [
        { role: "user", content: h.message, id: h.id + "-user", time: h.created_at },
        { role: "ai", content: h.response, id: h.id + "-ai", time: h.created_at },
      ]);
      setMessages(formatted);
    }).catch(() => {});
    if (id) api.projects.get(id).then((d) => setProject(d.project)).catch(() => {});
    else setProject(null);
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function renderContent(content) {
    const parts = content.split(/(```[\s\S]*?```|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const lines = part.slice(3, -3).split("\n");
        const lang = lines[0];
        const code = lines.slice(1).join("\n");
        return <pre key={i} style={{ margin: "8px 0" }}><code>{code}</code></pre>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i}>{part.slice(1, -1)}</code>;
      }
      return <span key={i}>{part}</span>;
    });
  }

  const QUICK_PROMPTS = [
    "Show me the project file structure",
    "Fix any syntax errors in the code",
    "Add error handling to all routes",
    "Generate a README.md for this project",
    "Optimize the code for performance",
    "Add logging to all functions",
  ];

  return (
    <div className="chat-layout">
      {/* Toolbar */}
      <div style={{ padding: "10px 24px", background: "var(--bg2)", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select className="form-select" style={{ width: "auto", minWidth: 200 }}
          value={selectedProject} onChange={(e) => handleProjectChange(e.target.value)}>
          <option value="">No project (general chat)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
          ))}
        </select>

        {project && (
          <div style={{ display: "flex", gap: 8 }}>
            <Link to={`/projects/${project.id}/editor`} className="btn btn-sm btn-ghost">Files</Link>
            <Link to={`/projects/${project.id}/logs`} className="btn btn-sm btn-ghost">Logs</Link>
          </div>
        )}

        <button className="btn btn-sm btn-ghost" style={{ marginLeft: "auto", color: "var(--danger)" }} onClick={handleClear}>
          Clear History
        </button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>🤖</div>
            <h3>AI Assistant</h3>
            <p style={{ marginTop: 8, maxWidth: 460, margin: "8px auto" }}>
              Powered by Gemma 3n via NVIDIA. I can create, edit, and debug your project files.
              {selectedProject ? ` Working on: ${project?.name || "..."}` : " Select a project to work on files."}
            </p>
            {!selectedProject && (
              <p className="text-sm text-muted" style={{ marginTop: 8 }}>
                Select a project above to enable file operations.
              </p>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 20 }}>
              {QUICK_PROMPTS.map((p) => (
                <button key={p} className="btn btn-ghost btn-sm" onClick={() => setInput(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-bubble">
              {renderContent(msg.content)}
              {msg.actionResults && msg.actionResults.length > 0 && (
                <div className="action-result">
                  <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--text2)" }}>Actions performed:</div>
                  {msg.actionResults.map((r, i) => (
                    <div key={i} style={{ color: r.success ? "var(--success)" : "var(--danger)" }}>
                      {r.success ? "✓" : "✗"} {r.action}: {r.path || "—"} {r.error ? `(${r.error})` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="message-meta">{formatTime(msg.time)}</div>
          </div>
        ))}

        {loading && (
          <div className="message ai">
            <div className="message-bubble" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="spinner" />
              <span style={{ color: "var(--text2)" }}>Thinking…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-error" style={{ maxWidth: 600 }}>{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form className="chat-input-area" onSubmit={handleSend}>
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder={selectedProject
            ? `Ask AI to create, edit, or debug ${project?.name || "project"} files…`
            : "Ask anything about coding, debugging, or select a project to modify files…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={loading}
        />
        <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()}
          style={{ alignSelf: "flex-end" }}>
          {loading ? <span className="spinner" /> : "Send"}
        </button>
      </form>
    </div>
  );
}
