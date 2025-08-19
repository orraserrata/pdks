import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

export default function PersonelYonetimi({ onChanged }) {
  const [form, setForm] = useState({
    kullanici_id: "",
    isim: "",
    soyisim: "",
    ise_giris_tarihi: "",
    aktif: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [kullaniciProfilleri, setKullaniciProfilleri] = useState([]);
  const [personeller, setPersoneller] = useState([]);
  const [filter, setFilter] = useState("active");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    isim: "",
    soyisim: "",
    ise_giris_tarihi: "",
    aktif: true,
  });

  const isValid = useMemo(() => {
    return (
      String(form.kullanici_id).trim() !== "" &&
      form.isim.trim() !== "" &&
      form.soyisim.trim() !== "" &&
      form.ise_giris_tarihi.trim() !== ""
    );
  }, [form]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Kullanıcı profilini yükle
  useEffect(() => {
    async function loadUserProfile() {
      if (!session?.user) {
        setUserProfile(null);
        return;
      }
      
      try {
        const email = session?.user?.email || null;
        
        // Önce kullanici_profilleri tablosundan kontrol et
        let { data, error } = await supabase
          .from("kullanici_profilleri")
          .select("*")
          .eq("email", email)
          .maybeSingle();
        
        if (data) {
          setUserProfile(data);
        } else {
          // Profil bulunamadı - admin_users tablosundan kontrol et
          const { data: authUser } = await supabase.auth.getUser();
          
          if (authUser?.user?.id) {
            const adminCheck = await supabase
              .from("admin_users")
              .select("user_id")
              .eq("user_id", authUser.user.id)
              .maybeSingle();
            
            if (adminCheck.data) {
              // Admin kullanıcı - geçici admin profili oluştur
              const tempAdminProfile = {
                id: -1,
                kullanici_id: null,
                email: email,
                isim: "Admin",
                soyisim: "Kullanıcı",
                is_admin: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              setUserProfile(tempAdminProfile);
            } else {
              setUserProfile(null);
            }
          } else {
            setUserProfile(null);
          }
        }
      } catch (err) {
        console.error("Profil yükleme hatası:", err);
        setUserProfile(null);
      }
    }

    loadUserProfile();
  }, [session]);

  // Kullanıcı profillerini yükle
  useEffect(() => {
    async function loadKullaniciProfilleri() {
      try {
        const { data, error } = await supabase
          .from("kullanici_profilleri")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data) {
          setKullaniciProfilleri(data);
        }
      } catch (err) {
        console.warn("Kullanıcı profilleri yükleme hatası:", err);
      }
    }

    loadKullaniciProfilleri();
  }, []);

  // Personelleri yükle
  useEffect(() => {
    async function loadPersoneller() {
      try {
        let query = supabase.from("personel").select("*");
        
        if (filter === "active") {
          query = query.eq("aktif", true);
        } else if (filter === "inactive") {
          query = query.eq("aktif", false);
        }
        
        const { data, error } = await query.order("isim", { ascending: true });
        
        if (!error && data) {
          setPersoneller(data);
        }
      } catch (err) {
        console.warn("Personel yükleme hatası:", err);
      }
    }

    loadPersoneller();
  }, [filter]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    setError("");
    try {
      const payload = {
        kullanici_id: Number(form.kullanici_id),
        isim: form.isim.trim(),
        soyisim: form.soyisim.trim(),
        ise_giris_tarihi: form.ise_giris_tarihi,
        aktif: form.aktif,
      };

      const { error: insertError } = await supabase
        .from("personel")
        .insert(payload);

      if (insertError) {
        setError(insertError.message || "Kayıt eklenemedi");
      } else {
        setForm({ kullanici_id: "", isim: "", soyisim: "", ise_giris_tarihi: "", aktif: true });
        if (onChanged) onChanged();
      }
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(kullaniciId, currentStatus) {
    const newStatus = !currentStatus;
    const action = newStatus ? "aktif" : "pasif";
    
    if (!window.confirm(`Bu personeli ${action} yapmak istediğinize emin misiniz?`)) return;
    
    setLoading(true);
    setError("");
    try {
      // Önce personel durumunu güncelle
      const { error: updateError } = await supabase
        .from("personel")
        .update({ aktif: newStatus })
        .eq("kullanici_id", kullaniciId);

      if (updateError) {
        setError(updateError.message || "Durum güncelleme başarısız");
        return;
      }

      // Eğer pasif yapılıyorsa, mevcut verileri admin_locked=true yap
      if (!newStatus) {
        const { error: lockError } = await supabase
          .from("personel_giris_cikis_duzenli")
          .update({ admin_locked: true })
          .eq("kullanici_id", kullaniciId);

        if (lockError) {
          console.warn("Veri kilitleme uyarısı:", lockError);
        }
      }

      // Eğer aktif yapılıyorsa, generate_attendance_pairs fonksiyonunu çağır
      if (newStatus) {
        const { error: functionError } = await supabase.rpc('generate_attendance_pairs');
        if (functionError) {
          console.warn("Fonksiyon çağırma uyarısı:", functionError);
        }
      }

      // Personelleri yeniden yükle
      const { data, error } = await supabase
        .from("personel")
        .select("*")
        .order("isim", { ascending: true });

      if (!error && data) {
        setPersoneller(data);
      }

      alert(`Personel ${action} yapıldı!`);
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  // Admin yetkisi verme/kaldırma fonksiyonu
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
        // Kullanıcı profillerini yeniden yükle
        const { data, error } = await supabase
          .from("kullanici_profilleri")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data) {
          setKullaniciProfilleri(data);
        }
        
        alert(`Admin yetkisi ${newAdminStatus ? 'verildi' : 'kaldırıldı'}!`);
      }
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteWithUndo(kullaniciId) {
    if (!window.confirm("Bu personeli silmek istediğinize emin misiniz? Bu işlem geri alınamaz!")) return;
    
    setLoading(true);
    setError("");
    try {
      const { error: deleteError } = await supabase
        .from("personel")
        .delete()
        .eq("kullanici_id", kullaniciId);

      if (deleteError) {
        setError(deleteError.message || "Silme işlemi başarısız");
      } else {
        // Personelleri yeniden yükle
        const { data, error } = await supabase
          .from("personel")
          .select("*")
          .order("isim", { ascending: true });

        if (!error && data) {
          setPersoneller(data);
        }

        alert("Personel silindi!");
      }
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("personel")
        .update({
          isim: editForm.isim.trim(),
          soyisim: editForm.soyisim.trim(),
          ise_giris_tarihi: editForm.ise_giris_tarihi,
          aktif: editForm.aktif,
        })
        .eq("kullanici_id", editingId);

      if (updateError) {
        setError(updateError.message || "Güncelleme başarısız");
      } else {
        setEditingId(null);
        setEditForm({ isim: "", soyisim: "", ise_giris_tarihi: "", aktif: true });
        
        // Personelleri yeniden yükle
        const { data, error } = await supabase
          .from("personel")
          .select("*")
          .order("isim", { ascending: true });

        if (!error && data) {
          setPersoneller(data);
        }

        alert("Personel güncellendi!");
      }
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <h2>Personel Yönetimi</h2>

      {session ? (
        <>
                     {/* Personel Ekleme Formu - Sadece Admin */}
           {userProfile && userProfile.is_admin && (
            <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label>
              Kullanıcı ID
              <input
                type="number"
                name="kullanici_id"
                value={form.kullanici_id}
                onChange={handleChange}
                required
                style={{ marginLeft: 6 }}
              />
            </label>
            <label>
              İsim
              <input
                type="text"
                name="isim"
                value={form.isim}
                onChange={handleChange}
                required
                style={{ marginLeft: 6 }}
              />
            </label>
            <label>
              Soyisim
              <input
                type="text"
                name="soyisim"
                value={form.soyisim}
                onChange={handleChange}
                required
                style={{ marginLeft: 6 }}
              />
            </label>
            <label>
              İşe Giriş Tarihi
              <input
                type="date"
                name="ise_giris_tarihi"
                value={form.ise_giris_tarihi}
                onChange={handleChange}
                required
                style={{ marginLeft: 6 }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                name="aktif"
                checked={form.aktif}
                onChange={(e) => setForm(prev => ({ ...prev, aktif: e.target.checked }))}
                style={{ marginRight: 6 }}
              />
              Aktif
            </label>
            <button type="submit" disabled={loading || !isValid}>
              {loading ? "Ekleniyor..." : "Ekle"}
            </button>
          </form>
          )}

          {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}

          {/* Filtreleme Butonları */}
          <div style={{ marginTop: "20px", display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: "500", color: "#374151" }}>Personel Durumu:</span>
            <button
              onClick={() => setFilter("active")}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                backgroundColor: filter === "active" ? "#10b981" : "#f3f4f6",
                color: filter === "active" ? "white" : "#374151",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                transition: "all 0.2s"
              }}
            >
              Aktif
            </button>
            <button
              onClick={() => setFilter("inactive")}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                backgroundColor: filter === "inactive" ? "#f59e0b" : "#f3f4f6",
                color: filter === "inactive" ? "white" : "#374151",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                transition: "all 0.2s"
              }}
            >
              Pasif
            </button>
            <button
              onClick={() => setFilter("all")}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                backgroundColor: filter === "all" ? "#3b82f6" : "#f3f4f6",
                color: filter === "all" ? "white" : "#374151",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                transition: "all 0.2s"
              }}
            >
              Tümü
            </button>
          </div>

          {/* Personel Listesi */}
          <div style={{ marginTop: "20px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "white", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>Kullanıcı ID</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>İsim</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>Soyisim</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>İşe Giriş Tarihi</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>Durum</th>
                  {userProfile && userProfile.is_admin && (
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>İşlemler</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {personeller.map((p) => (
                  <tr key={p.kullanici_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 16px", fontSize: "14px", color: "#374151" }}>{p.kullanici_id}</td>
                    <td style={{ padding: "12px 16px", fontSize: "14px", color: "#374151" }}>{p.isim}</td>
                    <td style={{ padding: "12px 16px", fontSize: "14px", color: "#374151" }}>{p.soyisim}</td>
                    <td style={{ padding: "12px 16px", fontSize: "14px", color: "#374151" }}>{p.ise_giris_tarihi}</td>
                    <td style={{ padding: "12px 16px", fontSize: "14px" }}>
                      <span style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "500",
                        backgroundColor: p.aktif ? "#dcfce7" : "#fee2e2",
                        color: p.aktif ? "#166534" : "#dc2626"
                      }}>
                        {p.aktif ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    {userProfile && userProfile.is_admin && (
                      <td style={{ padding: "12px 16px", fontSize: "14px" }}>
                      {editingId === p.kullanici_id ? (
                        <form onSubmit={handleEditSubmit} style={{ display: "flex", gap: "4px" }}>
                          <input
                            type="text"
                            value={editForm.isim}
                            onChange={(e) => setEditForm(prev => ({ ...prev, isim: e.target.value }))}
                            placeholder="İsim"
                            style={{ padding: "4px 8px", fontSize: "12px", border: "1px solid #d1d5db", borderRadius: "4px", width: "80px" }}
                          />
                          <input
                            type="text"
                            value={editForm.soyisim}
                            onChange={(e) => setEditForm(prev => ({ ...prev, soyisim: e.target.value }))}
                            placeholder="Soyisim"
                            style={{ padding: "4px 8px", fontSize: "12px", border: "1px solid #d1d5db", borderRadius: "4px", width: "80px" }}
                          />
                          <input
                            type="date"
                            value={editForm.ise_giris_tarihi}
                            onChange={(e) => setEditForm(prev => ({ ...prev, ise_giris_tarihi: e.target.value }))}
                            style={{ padding: "4px 8px", fontSize: "12px", border: "1px solid #d1d5db", borderRadius: "4px" }}
                          />
                          <label style={{ display: "flex", alignItems: "center", fontSize: "12px" }}>
                            <input
                              type="checkbox"
                              checked={editForm.aktif}
                              onChange={(e) => setEditForm(prev => ({ ...prev, aktif: e.target.checked }))}
                              style={{ marginRight: "4px" }}
                            />
                            Aktif
                          </label>
                          <button
                            type="submit"
                            disabled={loading}
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              backgroundColor: "#10b981",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: loading ? "not-allowed" : "pointer"
                            }}
                          >
                            Kaydet
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              backgroundColor: "#6b7280",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer"
                            }}
                          >
                            İptal
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            onClick={() => handleToggleStatus(p.kullanici_id, p.aktif)}
                            style={{
                              padding: "8px 16px",
                              fontSize: "13px",
                              backgroundColor: p.aktif ? "#f59e0b" : "#10b981",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontWeight: "500",
                              transition: "all 0.2s",
                              boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = p.aktif ? "#d97706" : "#059669";
                              e.target.style.transform = "translateY(-1px)";
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = p.aktif ? "#f59e0b" : "#10b981";
                              e.target.style.transform = "translateY(0)";
                            }}
                          >
                            {p.aktif ? "Pasif Yap" : "Aktif Yap"}
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(p.kullanici_id);
                              setEditForm({
                                isim: p.isim || "",
                                soyisim: p.soyisim || "",
                                ise_giris_tarihi: p.ise_giris_tarihi || "",
                                aktif: p.aktif || true,
                              });
                            }}
                            style={{
                              padding: "8px 16px",
                              fontSize: "13px",
                              backgroundColor: "#3b82f6",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontWeight: "500",
                              transition: "all 0.2s",
                              boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = "#2563eb";
                              e.target.style.transform = "translateY(-1px)";
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = "#3b82f6";
                              e.target.style.transform = "translateY(0)";
                            }}
                          >
                            Düzenle
                          </button>
                          <button 
                            onClick={() => handleDeleteWithUndo(p.kullanici_id)}
                            style={{
                              padding: "8px 16px",
                              fontSize: "13px",
                              backgroundColor: "#ef4444",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontWeight: "500",
                              transition: "all 0.2s",
                              boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = "#dc2626";
                              e.target.style.transform = "translateY(-1px)";
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = "#ef4444";
                              e.target.style.transform = "translateY(0)";
                            }}
                          >
                            Sil
                          </button>
                        </>
                      )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

                     {/* Kullanıcı Profilleri Yönetimi - Sadece Admin */}
           {userProfile && userProfile.is_admin && (
            <div style={{ marginTop: "40px" }}>
            <h3 style={{ marginBottom: "20px", color: "#374151", fontSize: "18px", fontWeight: "600" }}>
              Kullanıcı Hesapları Yönetimi
            </h3>
            
            <div style={{
              backgroundColor: "white",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              overflow: "hidden",
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                      E-posta
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                      İsim
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                      Soyisim
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                      Kullanıcı ID
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                      Admin
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                      Kayıt Tarihi
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {kullaniciProfilleri.map((profile) => (
                    <tr key={profile.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: "#374151" }}>
                        {profile.email}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: "#374151" }}>
                        {profile.isim || "-"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: "#374151" }}>
                        {profile.soyisim || "-"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: "#374151" }}>
                        {profile.kullanici_id}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "14px" }}>
                        <span style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "500",
                          backgroundColor: profile.is_admin ? "#dcfce7" : "#fef3c7",
                          color: profile.is_admin ? "#166534" : "#92400e"
                        }}>
                          {profile.is_admin ? "Admin" : "Kullanıcı"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "14px", color: "#6b7280" }}>
                        {new Date(profile.created_at).toLocaleDateString('tr-TR')}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "14px" }}>
                        <button
                          onClick={() => handleToggleAdmin(profile.email, profile.is_admin)}
                          disabled={loading}
                          style={{
                            padding: "6px 12px",
                            fontSize: "12px",
                            backgroundColor: profile.is_admin ? "#f59e0b" : "#3b82f6",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: loading ? "not-allowed" : "pointer",
                            fontWeight: "500",
                            transition: "all 0.2s"
                          }}
                        >
                          {profile.is_admin ? "Admin Yetkisini Kaldır" : "Admin Yap"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </>
      ) : (
        <div style={{ padding: "20px", backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: "8px" }}>
          <div style={{ fontSize: "16px", color: "#92400e", fontWeight: "500", marginBottom: "8px" }}>
            🔒 Admin Girişi Gerekli
          </div>
          <div style={{ fontSize: "14px", color: "#92400e" }}>
            Personel yönetimi için lütfen admin hesabıyla giriş yapın.
          </div>
        </div>
      )}
    </div>
  );
}
