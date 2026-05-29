import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import { useAuth } from "../App";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyMsg, setVerifyMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.auth.login(form.email, form.password);
      login(data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
      if (err.message.toLowerCase().includes("verif")) {
        setShowVerify(true);
        setVerifyEmail(form.email);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setVerifyMsg("");
    try {
      await api.auth.verifyEmail(verifyEmail, verifyCode);
      setVerifyMsg("Email verified! You can now log in.");
      setShowVerify(false);
    } catch (err) {
      setVerifyMsg(err.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>🖥️ TermuxHost</h1>
          <p>Sign in to your account</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {!showVerify ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? <><span className="spinner" /> Signing in…</> : "Sign In"}
            </button>
            <div style={{ textAlign: "right", marginTop: 10 }}>
              <Link to="/forgot-password" style={{ fontSize: "0.85rem" }}>Forgot password?</Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <p style={{ marginBottom: 14 }}>Enter the verification code sent to <strong>{verifyEmail}</strong>.</p>
            {verifyMsg && <div className={`alert ${verifyMsg.includes("verified") ? "alert-success" : "alert-error"}`}>{verifyMsg}</div>}
            <div className="form-group">
              <label className="form-label">Verification Code</label>
              <input
                type="text"
                className="form-input"
                placeholder="6-digit code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                maxLength={6}
                required
              />
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }}>Verify Email</button>
            <button type="button" className="btn btn-ghost" style={{ width: "100%", marginTop: 8 }}
              onClick={() => setShowVerify(false)}>Back to Login</button>
          </form>
        )}

        <div className="auth-footer">
          Don't have an account? <Link to="/register">Register</Link>
        </div>
      </div>
    </div>
  );
}
