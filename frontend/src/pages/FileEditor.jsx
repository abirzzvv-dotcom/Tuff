import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../utils/api";

function getFileIcon(name) {
  if (!name) return "📄";
  const ext = name.split(".").pop()?.toLowerCase();
  const icons = { js: "🟨", jsx: "⚛️", ts: "🔷", tsx: "⚛️", py: "🐍", json: "📋",
    md: "📝", txt: "📝", html: "🌐", css: "🎨", env: "🔐", sh: "⚙️", yml: "⚙️",
    yaml: "⚙️", toml: "⚙️", gitignore: "🚫" };
  return icons[ext] || "📄";
}

function getLanguageHint(filename) {
  const ext = filename?.split(".").pop()?.toLowerCase();
  const hints = { js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    py: "python", json: "json", md: "markdown", html: "html", css: "css",
    sh: "bash", yml: "yaml", yaml: "yaml" };
  return hints[ext] || "plaintext";
}

export default function FileEditor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState("");
  const [openFile, setOpenFile] = useState(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [project, setProject] = useState(null);
  const [newFileName, setNewFileName] = useState("");
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewDir, setShowNewDir] = useState(false);
  const [newDirName, setNewDirName] = useState("");

  useEffect(() => {
    loadProject();
    loadFiles();
  }, [projectId]);

  async function loadProject() {
    try {
      const data = await api.projects.get(projectId);
      setProject(data.project);
    } catch {}
  }

  async function loadFiles(path = "") {
    setLoading(true);
    try {
      const data = await api.files.list(projectId, path);
      setFiles(data.files.sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      }));
      setCurrentPath(path);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function openFileForEdit(file) {
    if (file.type === "directory") {
      loadFiles(file.path);
      return;
    }
    setLoading(true);
    try {
      const data = await api.files.read(projectId, file.path);
      setOpenFile(file);
      setContent(data.content);
      setOriginalContent(data.content);
    } catch (err) {
      setError("Could not open file: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!openFile) return;
    setSaving(true);
    try {
      await api.files.write(projectId, openFile.path, content);
      setOriginalContent(content);
      flash("File saved", "success");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(file, e) {
    e.stopPropagation();
    if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
    try {
      await api.files.delete(projectId, file.path);
      if (openFile?.path === file.path) { setOpenFile(null); setContent(""); }
      loadFiles(currentPath);
      flash("Deleted", "success");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateFile(e) {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const path = currentPath ? `${currentPath}/${newFileName.trim()}` : newFileName.trim();
    try {
      await api.files.write(projectId, path, "");
      setShowNewFile(false);
      setNewFileName("");
      loadFiles(currentPath);
      setOpenFile({ name: newFileName.trim(), path, type: "file" });
      setContent("");
      setOriginalContent("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateDir(e) {
    e.preventDefault();
    if (!newDirName.trim()) return;
    const path = currentPath ? `${currentPath}/${newDirName.trim()}` : newDirName.trim();
    try {
      await api.files.mkdir(projectId, path);
      setShowNewDir(false);
      setNewDirName("");
      loadFiles(currentPath);
    } catch (err) {
      setError(err.message);
    }
  }

  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const sel = e.target;
      const start = sel.selectionStart;
      const end = sel.selectionEnd;
      const newContent = content.substring(0, start) + "  " + content.substring(end);
      setContent(newContent);
      requestAnimationFrame(() => {
        sel.selectionStart = sel.selectionEnd = start + 2;
      });
    }
  }, [content]);

  const isDirty = content !== originalContent;

  function flash(msg, type = "success") {
    setMessage({ text: msg, type });
    setTimeout(() => setMessage(""), 3000);
  }

  const breadcrumbs = currentPath ? currentPath.split("/") : [];

  return (
    <div className="editor-layout">
      {/* File Sidebar */}
      <div className="editor-sidebar">
        <div style={{ padding: "10px 8px 6px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
            {project?.name || "Files"}
          </div>

          {/* Breadcrumbs */}
          {currentPath && (
            <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginBottom: 6, display: "flex", flexWrap: "wrap", gap: 2 }}>
              <button style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0, fontSize: "0.75rem" }}
                onClick={() => loadFiles("")}>root</button>
              {breadcrumbs.map((part, i) => (
                <React.Fragment key={i}>
                  <span>/</span>
                  <button style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0, fontSize: "0.75rem" }}
                    onClick={() => loadFiles(breadcrumbs.slice(0, i + 1).join("/"))}>
                    {part}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 4 }}>
            <button className="btn btn-sm btn-ghost" title="New file" onClick={() => setShowNewFile(true)} style={{ flex: 1, fontSize: "0.78rem" }}>+ File</button>
            <button className="btn btn-sm btn-ghost" title="New folder" onClick={() => setShowNewDir(true)} style={{ flex: 1, fontSize: "0.78rem" }}>+ Dir</button>
            {currentPath && (
              <button className="btn btn-sm btn-ghost" onClick={() => loadFiles(currentPath.includes("/") ? currentPath.substring(0, currentPath.lastIndexOf("/")) : "")}>↑</button>
            )}
          </div>

          {showNewFile && (
            <form onSubmit={handleCreateFile} style={{ marginTop: 6 }}>
              <input className="form-input" style={{ fontSize: "0.8rem", padding: "5px 8px", marginBottom: 4 }}
                placeholder="filename.js" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} autoFocus />
              <div style={{ display: "flex", gap: 4 }}>
                <button type="submit" className="btn btn-sm btn-primary" style={{ flex: 1 }}>Create</button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowNewFile(false)}>✕</button>
              </div>
            </form>
          )}

          {showNewDir && (
            <form onSubmit={handleCreateDir} style={{ marginTop: 6 }}>
              <input className="form-input" style={{ fontSize: "0.8rem", padding: "5px 8px", marginBottom: 4 }}
                placeholder="directory-name" value={newDirName} onChange={(e) => setNewDirName(e.target.value)} autoFocus />
              <div style={{ display: "flex", gap: 4 }}>
                <button type="submit" className="btn btn-sm btn-primary" style={{ flex: 1 }}>Create</button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowNewDir(false)}>✕</button>
              </div>
            </form>
          )}
        </div>

        <div className="file-tree">
          {loading && !openFile ? (
            <div style={{ padding: 12, textAlign: "center" }}><span className="spinner" /></div>
          ) : files.length === 0 ? (
            <div style={{ padding: 12, fontSize: "0.8rem", color: "var(--text3)", textAlign: "center" }}>Empty directory</div>
          ) : (
            files.map((file) => (
              <div key={file.path} className={`file-item${openFile?.path === file.path ? " active" : ""}`}
                onClick={() => openFileForEdit(file)}>
                <span className="fi-icon">{file.type === "directory" ? "📁" : getFileIcon(file.name)}</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                {file.type === "file" && (
                  <button style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: "2px 4px", fontSize: "0.75rem", opacity: 0.6 }}
                    onClick={(e) => handleDelete(file, e)}>✕</button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor Main */}
      <div className="editor-main">
        {error && (
          <div className="alert alert-error" style={{ margin: 8, borderRadius: 6 }} onClick={() => setError("")}>{error} ✕</div>
        )}
        {message && (
          <div className={`alert alert-${message.type}`} style={{ margin: 8, borderRadius: 6 }}>{message.text}</div>
        )}

        {openFile ? (
          <>
            <div className="editor-toolbar">
              <span className="editor-filename">{getFileIcon(openFile.name)} {openFile.path}</span>
              {isDirty && <span className="badge badge-warning" style={{ background: "rgba(245,158,11,0.15)", color: "var(--warning)" }}>unsaved</span>}
              <span className="ml-auto" />
              <button className="btn btn-sm btn-ghost" onClick={() => { setOpenFile(null); setContent(""); }}>Close</button>
              <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving || !isDirty}>
                {saving ? <span className="spinner" /> : "Save"} {isDirty ? "(Ctrl+S)" : ""}
              </button>
            </div>
            <textarea
              className="code-editor"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text3)", flexDirection: "column", gap: 12 }}>
            <span style={{ fontSize: "3rem" }}>📝</span>
            <p>Select a file to edit</p>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => navigate(`/projects/${projectId}/logs`)}>View Logs</button>
              <button className="btn btn-ghost" onClick={() => navigate(`/projects/${projectId}/ai`)}>Open AI</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
