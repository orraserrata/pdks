import React, { useState } from "react";
import { supabase } from "../supabaseClient";

export default function AdminLogin({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(signInError.message || "Giriş başarısız");
      } else if (onSuccess) onSuccess();
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3>Admin Girişi</h3>
      <form onSubmit={handleLogin} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label>
          E-posta
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ marginLeft: 6 }} />
        </label>
        <label>
          Şifre
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ marginLeft: 6 }} />
        </label>
        <button type="submit" disabled={loading}>{loading ? "Giriş yapılıyor..." : "Giriş Yap"}</button>
      </form>
      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
      <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
        Not: E-posta/şifre ile giriş için Supabase projenizde Email (Password) Auth aktif olmalıdır.
      </div>
    </div>
  );
}


