import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function AdminSettings() {
  const [session, setSession] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      await loadAdmins();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  if (!session) return null;

  return (
    <div>
      <h3>Admin Yönetimi</h3>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <button disabled={loading} onClick={bootstrapSelf}>İlk admin olarak kendimi ata</button>
        <label>
          E-posta ile admin ekle
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginLeft: 6 }} />
        </label>
        <button disabled={loading || !email.trim()} onClick={addAdmin}>Ekle</button>
      </div>

      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}

      <table border="1" style={{ marginTop: 12, borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>E-posta</th>
            <th>Kullanıcı ID</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {admins.map((a) => (
            <tr key={a.user_id}>
              <td>{a.email}</td>
              <td>{a.user_id}</td>
              <td>
                <button disabled={loading} onClick={() => removeAdmin(a.email)}>Kaldır</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


