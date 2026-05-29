const BASE_URL = import.meta.env.VITE_API_URL || "";

function getToken() {
  return localStorage.getItem("session_token");
}

function setToken(token) {
  localStorage.setItem("session_token", token);
}

function clearToken() {
  localStorage.removeItem("session_token");
  localStorage.removeItem("user");
}

function setUser(user) {
  localStorage.setItem("user", JSON.stringify(user));
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

async function request(method, path, body, isFormData = false) {
  const token = getToken();
  const headers = {};

  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!isFormData) headers["Content-Type"] = "application/json";

  const options = { method, headers };
  if (body !== undefined) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, options);
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    register: (username, email, password) =>
      request("POST", "/api/auth/register", { username, email, password }),
    login: async (email, password) => {
      const data = await request("POST", "/api/auth/login", { email, password });
      setToken(data.token);
      setUser(data.user);
      return data;
    },
    logout: async () => {
      try { await request("POST", "/api/auth/logout"); } catch {}
      clearToken();
    },
    me: () => request("GET", "/api/auth/me"),
    verifyEmail: (email, code) =>
      request("POST", "/api/auth/verify-email", { email, code }),
    resendVerification: () =>
      request("POST", "/api/auth/resend-verification"),
    forgotPassword: (email) =>
      request("POST", "/api/auth/forgot-password", { email }),
    resetPassword: (email, code, newPassword) =>
      request("POST", "/api/auth/reset-password", { email, code, newPassword }),
  },

  // ─── Projects ────────────────────────────────────────────────────────────────
  projects: {
    list: () => request("GET", "/api/projects"),
    create: (data) => request("POST", "/api/projects", data),
    get: (id) => request("GET", `/api/projects/${id}`),
    update: (id, data) => request("PUT", `/api/projects/${id}`, data),
    delete: (id) => request("DELETE", `/api/projects/${id}`),
    start: (id) => request("POST", `/api/projects/${id}/start`),
    stop: (id) => request("POST", `/api/projects/${id}/stop`),
    restart: (id) => request("POST", `/api/projects/${id}/restart`),
    installNpm: (id, packages) => request("POST", `/api/projects/${id}/install-npm`, { packages }),
    installPip: (id, packages) => request("POST", `/api/projects/${id}/install-pip`, { packages }),
    getLogs: (id, limit = 100) => request("GET", `/api/projects/${id}/logs?limit=${limit}`),
  },

  // ─── Files ───────────────────────────────────────────────────────────────────
  files: {
    list: (projectId, path = "") =>
      request("GET", `/api/files/${projectId}/list${path ? `?path=${encodeURIComponent(path)}` : ""}`),
    read: (projectId, path) =>
      request("GET", `/api/files/${projectId}/read?path=${encodeURIComponent(path)}`),
    write: (projectId, path, content) =>
      request("POST", `/api/files/${projectId}/write`, { path, content }),
    delete: (projectId, path) =>
      request("DELETE", `/api/files/${projectId}/delete`, { path }),
    mkdir: (projectId, path) =>
      request("POST", `/api/files/${projectId}/mkdir`, { path }),
    rename: (projectId, oldPath, newPath) =>
      request("POST", `/api/files/${projectId}/rename`, { oldPath, newPath }),
    upload: async (projectId, files, targetPath = "") => {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      if (targetPath) form.append("path", targetPath);
      return request("POST", `/api/files/${projectId}/upload`, form, true);
    },
  },

  // ─── AI ──────────────────────────────────────────────────────────────────────
  ai: {
    chat: (message, projectId = null) =>
      request("POST", "/api/ai/chat", { message, projectId }),
    history: (projectId = null, limit = 50) =>
      request("GET", `/api/ai/history?${projectId ? `projectId=${projectId}&` : ""}limit=${limit}`),
    clearHistory: (projectId = null) =>
      request("DELETE", `/api/ai/history${projectId ? `?projectId=${projectId}` : ""}`),
  },

  // ─── Admin ───────────────────────────────────────────────────────────────────
  admin: {
    stats: () => request("GET", "/api/admin/stats"),
    listUsers: (page = 1, limit = 20) =>
      request("GET", `/api/admin/users?page=${page}&limit=${limit}`),
    suspendUser: (id) => request("POST", `/api/admin/users/${id}/suspend`),
    unsuspendUser: (id) => request("POST", `/api/admin/users/${id}/unsuspend`),
    promoteUser: (id) => request("POST", `/api/admin/users/${id}/promote`),
    demoteUser: (id) => request("POST", `/api/admin/users/${id}/demote`),
    deleteUser: (id) => request("DELETE", `/api/admin/users/${id}`),
    listProjects: (page = 1, limit = 20) =>
      request("GET", `/api/admin/projects?page=${page}&limit=${limit}`),
    stopProject: (id) => request("POST", `/api/admin/projects/${id}/stop`),
    deleteProject: (id) => request("DELETE", `/api/admin/projects/${id}`),
  },

  // ─── Tunnel ──────────────────────────────────────────────────────────────────
  tunnel: {
    status: () => request("GET", "/api/tunnel"),
  },
};

export { getUser, setUser, getToken, clearToken };
