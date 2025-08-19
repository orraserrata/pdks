import React, { useState } from "react";
import { supabase } from "../supabaseClient";

export default function GirisYap({ onSuccess }) {
  const [form, setForm] = useState({
    email: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      console.log('Giriş yapılıyor:', form.email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password
      });

      if (error) {
        console.error('Giriş hatası:', error);
        setError(error.message);
      } else {
        console.log('Giriş başarılı:', data);
        
        // Session'ı manuel olarak kontrol et
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Yeni session:', session);
        
        setForm({
          email: "",
          password: ""
        });
        
        if (onSuccess) onSuccess();
        
        // Sayfa yenileme yerine modal'ı kapat
        console.log('Giriş başarılı, modal kapatılıyor');
      }
    } catch (err) {
      console.error('Beklenmeyen hata:', err);
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: "400px",
      margin: "0 auto",
      padding: "20px",
      backgroundColor: "white",
      borderRadius: "12px",
      border: "1px solid #e5e7eb",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
    }}>
      <h2 style={{ marginBottom: "20px", textAlign: "center", color: "#374151" }}>
        Giriş Yap
      </h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: "500", color: "#374151" }}>
            E-posta *
          </label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            placeholder="E-posta adresinizi girin"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px"
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: "500", color: "#374151" }}>
            Şifre *
          </label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
            placeholder="Şifrenizi girin"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px"
            }}
          />
        </div>

        {error && (
          <div style={{
            padding: "8px 12px",
            backgroundColor: "#fee2e2",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            color: "#dc2626",
            fontSize: "14px"
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px",
            backgroundColor: loading ? "#9ca3af" : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "500",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background-color 0.2s"
          }}
        >
          {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
        </button>
      </form>

      <div style={{
        marginTop: "16px",
        padding: "12px",
        backgroundColor: "#f0f9ff",
        border: "1px solid #bae6fd",
        borderRadius: "6px",
        fontSize: "13px",
        color: "#0369a1"
      }}>
        <strong>Not:</strong> Hesabınız yoksa önce "Hesap Oluştur" sekmesinden hesap oluşturun.
      </div>
    </div>
  );
}
