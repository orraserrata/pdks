import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import Modal from "./Modal";

export default function HataBildirimi({ open, onClose, calisan, tarih, giris, cikis }) {
  const [hataTipi, setHataTipi] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hataTipleri = [
    { value: "yanlis_giris", label: "Yanlış Giriş Saati" },
    { value: "yanlis_cikis", label: "Yanlış Çıkış Saati" },
    { value: "eksik_giris", label: "Giriş Kaydı Eksik" },
    { value: "eksik_cikis", label: "Çıkış Kaydı Eksik" },
    { value: "fazla_mesai", label: "Fazla Mesai Hesaplaması" },
    { value: "diger", label: "Diğer" }
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!hataTipi.trim() || !aciklama.trim()) {
      setError("Lütfen hata tipini ve açıklamayı doldurun.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: insertError } = await supabase
        .from("hata_bildirimleri")
        .insert({
          kullanici_id: calisan.kullanici_id,
          calisan_adi: `${calisan.isim || ""} ${calisan.soyisim || ""}`.trim(),
          tarih: tarih,
          giris_saati: giris,
          cikis_saati: cikis,
          hata_tipi: hataTipi,
          aciklama: aciklama.trim(),
          bildirim_tarihi: new Date().toISOString(),
          durum: "beklemede" // beklemede, inceleniyor, cozuldu, reddedildi
        });

      if (insertError) {
        setError(insertError.message || "Hata bildirimi gönderilemedi");
      } else {
        // Başarılı - modal'ı kapat ve formu temizle
        setHataTipi("");
        setAciklama("");
        onClose();
        alert("Hata bildiriminiz başarıyla gönderildi. En kısa sürede incelenecektir.");
      }
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Hata Bildirimi">
      <div style={{ padding: "16px" }}>
        <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "#f3f4f6", borderRadius: "8px" }}>
          <strong>Çalışan:</strong> {calisan?.isim} {calisan?.soyisim}<br />
          <strong>Tarih:</strong> {tarih}<br />
          <strong>Giriş:</strong> {giris}<br />
          <strong>Çıkış:</strong> {cikis}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
              Hata Tipi *
            </label>
            <select
              value={hataTipi}
              onChange={(e) => setHataTipi(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "14px"
              }}
              required
            >
              <option value="">Hata tipini seçin</option>
              {hataTipleri.map((tip) => (
                <option key={tip.value} value={tip.value}>
                  {tip.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
              Açıklama *
            </label>
            <textarea
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              placeholder="Hatanın detaylarını açıklayın..."
              style={{
                width: "100%",
                minHeight: "100px",
                padding: "8px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "14px",
                resize: "vertical"
              }}
              required
            />
          </div>

          {error && (
            <div style={{ color: "red", marginBottom: "16px", fontSize: "14px" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                backgroundColor: "white",
                cursor: "pointer"
              }}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                backgroundColor: "#dc2626",
                color: "white",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? "Gönderiliyor..." : "Hata Bildir"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
