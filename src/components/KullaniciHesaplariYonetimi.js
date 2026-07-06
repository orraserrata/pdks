import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Modal from "./Modal";

function getDisplayName(profile) {
  const fullName = `${profile.isim || ""} ${profile.soyisim || ""}`.trim();
  return fullName || profile.email || "Kullanıcı";
}

export default function KullaniciHesaplariYonetimi() {
  const [kullaniciProfilleri, setKullaniciProfilleri] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailProfile, setDetailProfile] = useState(null);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e) => setIsMobileViewport(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  async function loadKullaniciProfilleri() {
    try {
      const { data, error: loadError } = await supabase
        .from("kullanici_profilleri")
        .select("*")
        .order("created_at", { ascending: false });

      if (!loadError && data) {
        setKullaniciProfilleri(data);
      }
    } catch (err) {
      console.warn("Kullanıcı profilleri yükleme hatası:", err);
    }
  }

  useEffect(() => {
    loadKullaniciProfilleri();
  }, []);

  async function handleToggleAdmin(email, currentAdminStatus) {
    const newAdminStatus = !currentAdminStatus;
    const action = newAdminStatus ? "admin yetkisi vermek" : "admin yetkisini kaldırmak";

    if (!window.confirm(`Bu kullanıcıya ${action} istediğinize emin misiniz?`)) return;

    setLoading(true);
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("kullanici_profilleri")
        .update({ is_admin: newAdminStatus })
        .eq("email", email);

      if (updateError) {
        setError(updateError.message || "Admin yetkisi güncelleme başarısız");
      } else {
        await loadKullaniciProfilleri();
        setDetailProfile(null);
        alert(`Admin yetkisi ${newAdminStatus ? "verildi" : "kaldırıldı"}!`);
      }
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="kullanici-hesaplari-section">
      <h3 className="kullanici-hesaplari-title">Kullanıcı Hesapları Yönetimi</h3>

      {error && <div className="personel-error">{error}</div>}

      {isMobileViewport ? (
        <div className="personel-mobile-list">
          {kullaniciProfilleri.length === 0 ? (
            <div className="personel-empty">Kullanıcı bulunamadı.</div>
          ) : (
            kullaniciProfilleri.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className="personel-collapsed-card personel-collapsed-card--name-only"
                onClick={() => setDetailProfile(profile)}
              >
                <div className="personel-collapsed-card-name">{getDisplayName(profile)}</div>
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="kullanici-hesaplari-table-wrap">
          <table className="mobile-table kullanici-hesaplari-table">
            <thead>
              <tr>
                <th>E-posta</th>
                <th>İsim</th>
                <th>Soyisim</th>
                <th>Kullanıcı ID</th>
                <th>Admin</th>
                <th>Kayıt Tarihi</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {kullaniciProfilleri.map((profile) => (
                <tr key={profile.id}>
                  <td data-label="E-posta">{profile.email}</td>
                  <td data-label="İsim">{profile.isim || "-"}</td>
                  <td data-label="Soyisim">{profile.soyisim || "-"}</td>
                  <td data-label="Kullanıcı ID">{profile.kullanici_id}</td>
                  <td data-label="Admin">
                    <span className={`personel-status-badge${profile.is_admin ? " personel-status-badge--active" : " personel-status-badge--inactive"}`}>
                      {profile.is_admin ? "Admin" : "Kullanıcı"}
                    </span>
                  </td>
                  <td data-label="Kayıt Tarihi">
                    {new Date(profile.created_at).toLocaleDateString("tr-TR")}
                  </td>
                  <td data-label="İşlemler">
                    <button
                      type="button"
                      className="kullanici-admin-toggle-btn"
                      onClick={() => handleToggleAdmin(profile.email, profile.is_admin)}
                      disabled={loading}
                      data-admin={profile.is_admin ? "true" : "false"}
                    >
                      {profile.is_admin ? "Admin Yetkisini Kaldır" : "Admin Yap"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={isMobileViewport && !!detailProfile}
        onClose={() => setDetailProfile(null)}
        title={detailProfile ? getDisplayName(detailProfile) : "Kullanıcı Detayı"}
      >
        {detailProfile && (
          <div className="personel-detail-dialog">
            <div className="personel-detail-grid">
              <div className="personel-detail-item personel-detail-item--full">
                <span className="personel-detail-label">E-posta</span>
                <span className="personel-detail-value">{detailProfile.email}</span>
              </div>
              <div className="personel-detail-item">
                <span className="personel-detail-label">İsim</span>
                <span className="personel-detail-value">{detailProfile.isim || "-"}</span>
              </div>
              <div className="personel-detail-item">
                <span className="personel-detail-label">Soyisim</span>
                <span className="personel-detail-value">{detailProfile.soyisim || "-"}</span>
              </div>
              <div className="personel-detail-item">
                <span className="personel-detail-label">Kullanıcı ID</span>
                <span className="personel-detail-value">{detailProfile.kullanici_id ?? "-"}</span>
              </div>
              <div className="personel-detail-item">
                <span className="personel-detail-label">Rol</span>
                <span className={`personel-status-badge${detailProfile.is_admin ? " personel-status-badge--active" : " personel-status-badge--inactive"}`}>
                  {detailProfile.is_admin ? "Admin" : "Kullanıcı"}
                </span>
              </div>
              <div className="personel-detail-item personel-detail-item--full">
                <span className="personel-detail-label">Kayıt Tarihi</span>
                <span className="personel-detail-value">
                  {new Date(detailProfile.created_at).toLocaleDateString("tr-TR")}
                </span>
              </div>
            </div>
            <div className="personel-detail-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={loading}
                onClick={() => handleToggleAdmin(detailProfile.email, detailProfile.is_admin)}
              >
                {detailProfile.is_admin ? "Admin Yetkisini Kaldır" : "Admin Yap"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
