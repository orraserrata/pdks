import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import Modal from "./Modal";

export default function AdminSettings() {
  const [session, setSession] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailAdmin, setDetailAdmin] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadAdmins() {
    setError("");
    try {
      const { data, error: rpcErr } = await supabase.rpc("get_admins");
      if (rpcErr) throw rpcErr;
      setAdmins(data || []);
    } catch (e) {
      setError(String(e.message || e));
      setAdmins([]);
    }
  }

  useEffect(() => {
    if (session) loadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function bootstrapSelf() {
    setLoading(true);
    setError("");
    try {
      const { error: rpcErr } = await supabase.rpc("bootstrap_first_admin");
      if (rpcErr) throw rpcErr;
      await loadAdmins();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function addAdmin() {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { error: rpcErr } = await supabase.rpc("make_admin_by_email", { p_email: email.trim() });
      if (rpcErr) throw rpcErr;
      setEmail("");
      await loadAdmins();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function removeAdmin(targetEmail) {
    if (!window.confirm(`${targetEmail} admin yetkisi kaldırılsın mı?`)) return;
    setLoading(true);
    setError("");
    try {
      const { error: rpcErr } = await supabase.rpc("remove_admin_by_email", { p_email: targetEmail });
      if (rpcErr) throw rpcErr;
      setDetailAdmin(null);
      await loadAdmins();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  if (!session) return null;

  return (
    <div className="admin-section">
      <h3 className="admin-section-title">Admin Yönetimi</h3>

      <div className="personel-add-card">
        <div className="personel-form-grid personel-form-grid--add">
          <div className="personel-form-field personel-form-field--span-full-mobile">
            <label htmlFor="admin-add-email">E-posta ile Admin Ekle</label>
            <input
              id="admin-add-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@email.com"
            />
          </div>
        </div>
        <div className="personel-add-footer">
          <button
            type="button"
            className="maas-btn maas-btn--secondary"
            onClick={bootstrapSelf}
            disabled={loading}
          >
            İlk admin olarak kendimi ata
          </button>
          <button
            type="button"
            className="maas-btn maas-btn--primary"
            onClick={addAdmin}
            disabled={loading || !email.trim()}
          >
            Ekle
          </button>
        </div>
      </div>

      {error && <div className="personel-error">{error}</div>}

      {admins.length === 0 ? (
        <div className="personel-empty">Kayıtlı admin bulunamadı.</div>
      ) : (
        <div className="personel-mobile-list">
          {admins.map((a) => (
            <button
              key={a.user_id}
              type="button"
              className="personel-collapsed-card personel-collapsed-card--name-only"
              onClick={() => setDetailAdmin(a)}
            >
              <div className="personel-collapsed-card-name">{a.email}</div>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={!!detailAdmin}
        onClose={() => setDetailAdmin(null)}
        title={detailAdmin?.email || "Admin Detayı"}
      >
        {detailAdmin && (
          <div className="personel-detail-dialog">
            <div className="personel-detail-grid">
              <div className="personel-detail-item personel-detail-item--full">
                <span className="personel-detail-label">E-posta</span>
                <span className="personel-detail-value">{detailAdmin.email}</span>
              </div>
              <div className="personel-detail-item personel-detail-item--full">
                <span className="personel-detail-label">Kullanıcı ID</span>
                <span className="personel-detail-value">{detailAdmin.user_id}</span>
              </div>
            </div>
            <div className="personel-detail-actions">
              <button
                type="button"
                className="maas-btn maas-btn--danger"
                disabled={loading}
                onClick={() => removeAdmin(detailAdmin.email)}
              >
                Admin Yetkisini Kaldır
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
