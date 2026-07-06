import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { ensureMaasAyari, syncMaasAyariAktif } from "../utils/maasAyarlari";
import { CALISMA_TIPI_OPTIONS, getCalismaTipiLabel } from "../utils/yillikIzin";
import Modal from "./Modal";

const MAAS_TIPI_OPTIONS = [
  { value: "saatli", label: "Saatli Maaş" },
  { value: "gunluk", label: "Güne Göre Maaş" },
];

function getMaasTipiLabel(maasTipi) {
  return MAAS_TIPI_OPTIONS.find((o) => o.value === maasTipi)?.label || "Saatli Maaş";
}

export default function PersonelYonetimi({ onChanged }) {
  const [form, setForm] = useState({
    kullanici_id: "",
    isim: "",
    soyisim: "",
    ise_giris_tarihi: "",
    aktif: true,
    maas_tipi: "saatli",
    calisma_tipi: "full_time",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [personeller, setPersoneller] = useState([]);
  const [filter, setFilter] = useState("active");
  const [editingId, setEditingId] = useState(null);
  const [detailPersonel, setDetailPersonel] = useState(null);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );
  const [editForm, setEditForm] = useState({
    isim: "",
    soyisim: "",
    ise_giris_tarihi: "",
    aktif: true,
    maas_tipi: "saatli",
    calisma_tipi: "full_time",
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

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e) => setIsMobileViewport(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
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

  async function reloadPersoneller() {
    let query = supabase.from("personel").select("*");
    if (filter === "active") query = query.eq("aktif", true);
    else if (filter === "inactive") query = query.eq("aktif", false);
    const { data, error } = await query.order("isim", { ascending: true });
    if (!error && data) setPersoneller(data);
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
        maas_tipi: form.maas_tipi,
        calisma_tipi: form.calisma_tipi,
      };

      const { error: insertError } = await supabase
        .from("personel")
        .insert(payload);

      if (insertError) {
        setError(insertError.message || "Kayıt eklenemedi");
      } else {
        const { error: maasError } = await ensureMaasAyari(payload.kullanici_id, payload.aktif);
        if (maasError) {
          console.warn("Maaş ayarı oluşturulamadı:", maasError);
        }

        setForm({ kullanici_id: "", isim: "", soyisim: "", ise_giris_tarihi: "", aktif: true, maas_tipi: "saatli", calisma_tipi: "full_time" });
        await reloadPersoneller();
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

      const { error: maasSyncError } = await syncMaasAyariAktif(kullaniciId, newStatus);
      if (maasSyncError) {
        console.warn("Maaş ayarı durumu güncellenemedi:", maasSyncError);
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
      await reloadPersoneller();

      alert(`Personel ${action} yapıldı!`);
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
          maas_tipi: editForm.maas_tipi,
          calisma_tipi: editForm.calisma_tipi,
        })
        .eq("kullanici_id", editingId);

      if (updateError) {
        setError(updateError.message || "Güncelleme başarısız");
      } else {
        const { error: maasSyncError } = await syncMaasAyariAktif(editingId, editForm.aktif);
        if (maasSyncError) {
          console.warn("Maaş ayarı durumu güncellenemedi:", maasSyncError);
        }

        setEditingId(null);
        setDetailPersonel(null);
        setEditForm({ isim: "", soyisim: "", ise_giris_tarihi: "", aktif: true, maas_tipi: "saatli", calisma_tipi: "full_time" });
        await reloadPersoneller();

        alert("Personel güncellendi!");
      }
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  function openEditPersonel(p) {
    setEditingId(p.kullanici_id);
    setEditForm({
      isim: p.isim || "",
      soyisim: p.soyisim || "",
      ise_giris_tarihi: p.ise_giris_tarihi || "",
      aktif: p.aktif || true,
      maas_tipi: p.maas_tipi || "saatli",
      calisma_tipi: p.calisma_tipi || "full_time",
    });
    setDetailPersonel(null);
  }

  function closeEditPersonel() {
    setEditingId(null);
    setEditForm({ isim: "", soyisim: "", ise_giris_tarihi: "", aktif: true, maas_tipi: "saatli", calisma_tipi: "full_time" });
  }


  const renderFilterButtons = () => (
    <div className="personel-filter-bar force-wrap">
      <span className="personel-filter-label">Personel Durumu:</span>
      {[
        { value: "active", label: "Aktif", activeColor: "#10b981" },
        { value: "inactive", label: "Pasif", activeColor: "#f59e0b" },
        { value: "all", label: "Tümü", activeColor: "#3b82f6" },
      ].map((f) => (
        <button
          key={f.value}
          type="button"
          onClick={() => setFilter(f.value)}
          className={`personel-filter-btn${filter === f.value ? " personel-filter-btn--active" : ""}`}
          style={filter === f.value ? { backgroundColor: f.activeColor, borderColor: f.activeColor, color: "white" } : undefined}
        >
          {f.label}
        </button>
      ))}
    </div>
  );

  const renderEditFormFields = (onSubmit, onCancel) => (
    <form onSubmit={onSubmit} className="personel-form">
      <div className="personel-form-grid">
        <div className="personel-form-field">
          <label>İsim</label>
          <input
            type="text"
            value={editForm.isim}
            onChange={(e) => setEditForm((prev) => ({ ...prev, isim: e.target.value }))}
            required
          />
        </div>
        <div className="personel-form-field">
          <label>Soyisim</label>
          <input
            type="text"
            value={editForm.soyisim}
            onChange={(e) => setEditForm((prev) => ({ ...prev, soyisim: e.target.value }))}
            required
          />
        </div>
        <div className="personel-form-field personel-form-field--full">
          <label>İşe Giriş Tarihi</label>
          <input
            type="date"
            value={editForm.ise_giris_tarihi}
            onChange={(e) => setEditForm((prev) => ({ ...prev, ise_giris_tarihi: e.target.value }))}
            required
          />
        </div>
        <div className="personel-form-field">
          <label>Maaş Tipi</label>
          <select
            value={editForm.maas_tipi}
            onChange={(e) => setEditForm((prev) => ({ ...prev, maas_tipi: e.target.value }))}
          >
            {MAAS_TIPI_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="personel-form-field">
          <label>Çalışma Tipi</label>
          <select
            value={editForm.calisma_tipi}
            onChange={(e) => setEditForm((prev) => ({ ...prev, calisma_tipi: e.target.value }))}
          >
            {CALISMA_TIPI_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
      <label className="personel-form-checkbox">
        <input
          type="checkbox"
          checked={editForm.aktif}
          onChange={(e) => setEditForm((prev) => ({ ...prev, aktif: e.target.checked }))}
        />
        Aktif personel
      </label>
      <div className="personel-form-actions">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Kaydediliyor..." : "Kaydet"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          İptal
        </button>
      </div>
    </form>
  );

  return (
    <div style={{ marginBottom: 20 }}>
      <h2>Personel Yönetimi</h2>

      {session ? (
        <>
                     {/* Personel Ekleme Formu - Sadece Admin */}
           {userProfile && userProfile.is_admin && (
            isMobileViewport ? (
              <form onSubmit={handleSubmit} className="personel-add-card">
                <h3 className="personel-add-title">Yeni Personel Ekle</h3>
                <div className="personel-form-grid">
                  <div className="personel-form-field personel-form-field--full">
                    <label htmlFor="add-kullanici-id">Kullanıcı ID</label>
                    <input
                      id="add-kullanici-id"
                      type="number"
                      name="kullanici_id"
                      value={form.kullanici_id}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="personel-form-field">
                    <label htmlFor="add-isim">İsim</label>
                    <input id="add-isim" type="text" name="isim" value={form.isim} onChange={handleChange} required />
                  </div>
                  <div className="personel-form-field">
                    <label htmlFor="add-soyisim">Soyisim</label>
                    <input id="add-soyisim" type="text" name="soyisim" value={form.soyisim} onChange={handleChange} required />
                  </div>
                  <div className="personel-form-field personel-form-field--full">
                    <label htmlFor="add-ise-giris">İşe Giriş Tarihi</label>
                    <input id="add-ise-giris" type="date" name="ise_giris_tarihi" value={form.ise_giris_tarihi} onChange={handleChange} required />
                  </div>
                  <div className="personel-form-field">
                    <label htmlFor="add-maas-tipi">Maaş Tipi</label>
                    <select id="add-maas-tipi" name="maas_tipi" value={form.maas_tipi} onChange={handleChange}>
                      {MAAS_TIPI_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="personel-form-field">
                    <label htmlFor="add-calisma-tipi">Çalışma Tipi</label>
                    <select id="add-calisma-tipi" name="calisma_tipi" value={form.calisma_tipi} onChange={handleChange}>
                      {CALISMA_TIPI_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <label className="personel-form-checkbox">
                  <input
                    type="checkbox"
                    name="aktif"
                    checked={form.aktif}
                    onChange={(e) => setForm((prev) => ({ ...prev, aktif: e.target.checked }))}
                  />
                  Aktif personel
                </label>
                <button type="submit" className="btn-primary personel-add-submit" disabled={loading || !isValid}>
                  {loading ? "Ekleniyor..." : "Personel Ekle"}
                </button>
              </form>
            ) : (
            <form onSubmit={handleSubmit} className="responsive-flex" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
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
              Maaş Tipi
              <select
                name="maas_tipi"
                value={form.maas_tipi}
                onChange={handleChange}
                style={{ marginLeft: 6, padding: "4px 8px" }}
              >
                {MAAS_TIPI_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label>
              Çalışma Tipi
              <select
                name="calisma_tipi"
                value={form.calisma_tipi}
                onChange={handleChange}
                style={{ marginLeft: 6, padding: "4px 8px" }}
              >
                {CALISMA_TIPI_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
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
            )
          )}

          {error && <div className="personel-error">{error}</div>}

          {renderFilterButtons()}

          {/* Personel Listesi */}
          <div style={{ marginTop: "20px" }}>
            {isMobileViewport ? (
              <div className="personel-mobile-list">
                {personeller.length === 0 ? (
                  <div className="personel-empty">Personel bulunamadı.</div>
                ) : (
                  personeller.map((p) => (
                    <button
                      key={p.kullanici_id}
                      type="button"
                      className="personel-collapsed-card personel-collapsed-card--name-only"
                      onClick={() => setDetailPersonel(p)}
                    >
                      <div className="personel-collapsed-card-name">
                        {p.isim} {p.soyisim}
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
            <table className="mobile-table" style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "white", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>Kullanıcı ID</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>İsim</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>Soyisim</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>İşe Giriş Tarihi</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>Durum</th>
                  {userProfile && userProfile.is_admin && (
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>Maaş Tipi</th>
                  )}
                  {userProfile && userProfile.is_admin && (
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>Çalışma Tipi</th>
                  )}
                  {userProfile && userProfile.is_admin && (
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "14px", fontWeight: "600", color: "#374151" }}>İşlemler</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {personeller.map((p) => (
                  <tr key={p.kullanici_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td data-label="Kullanıcı ID" style={{ padding: "12px 16px", fontSize: "14px", color: "#374151" }}>{p.kullanici_id}</td>
                    <td data-label="İsim" style={{ padding: "12px 16px", fontSize: "14px", color: "#374151" }}>{p.isim}</td>
                    <td data-label="Soyisim" style={{ padding: "12px 16px", fontSize: "14px", color: "#374151" }}>{p.soyisim}</td>
                    <td data-label="İşe Giriş Tarihi" style={{ padding: "12px 16px", fontSize: "14px", color: "#374151" }}>{p.ise_giris_tarihi}</td>
                    <td data-label="Durum" style={{ padding: "12px 16px", fontSize: "14px" }}>
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
                      <td data-label="Maaş Tipi" style={{ padding: "12px 16px", fontSize: "14px" }}>
                        <span style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "500",
                          backgroundColor: (p.maas_tipi || "saatli") === "gunluk" ? "#e0e7ff" : "#fef3c7",
                          color: (p.maas_tipi || "saatli") === "gunluk" ? "#3730a3" : "#92400e",
                        }}>
                          {getMaasTipiLabel(p.maas_tipi || "saatli")}
                        </span>
                      </td>
                    )}
                    {userProfile && userProfile.is_admin && (
                      <td data-label="Çalışma Tipi" style={{ padding: "12px 16px", fontSize: "14px" }}>
                        <span style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          fontWeight: "500",
                          backgroundColor: (p.calisma_tipi || "full_time") === "part_time" ? "#fce7f3" : "#dbeafe",
                          color: (p.calisma_tipi || "full_time") === "part_time" ? "#9d174d" : "#1e40af",
                        }}>
                          {getCalismaTipiLabel(p.calisma_tipi || "full_time")}
                        </span>
                      </td>
                    )}
                    {userProfile && userProfile.is_admin && (
                      <td data-label="İşlemler" style={{ padding: "12px 16px", fontSize: "14px" }}>
                      <div className="force-wrap" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                      {editingId === p.kullanici_id && !isMobileViewport ? (
                        renderEditFormFields(handleEditSubmit, closeEditPersonel)
                      ) : (
                        <>
                          <button
                            type="button"
                            className={`btn-toggle-status${p.aktif ? " btn-toggle-status--deactivate" : " btn-toggle-status--activate"}`}
                            onClick={() => handleToggleStatus(p.kullanici_id, p.aktif)}
                          >
                            {p.aktif ? "Pasif Yap" : "Aktif Yap"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditPersonel(p)}
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
                      </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>

          <Modal
            open={isMobileViewport && !!detailPersonel}
            onClose={() => setDetailPersonel(null)}
            title={detailPersonel ? `${detailPersonel.isim || ""} ${detailPersonel.soyisim || ""}`.trim() : "Personel Detayı"}
          >
            {detailPersonel && (
              <div className="personel-detail-dialog">
                <div className="personel-detail-grid">
                  <div className="personel-detail-item">
                    <span className="personel-detail-label">Kullanıcı ID</span>
                    <span className="personel-detail-value">{detailPersonel.kullanici_id}</span>
                  </div>
                  <div className="personel-detail-item">
                    <span className="personel-detail-label">Durum</span>
                    <span className={`personel-status-badge${detailPersonel.aktif ? " personel-status-badge--active" : " personel-status-badge--inactive"}`}>
                      {detailPersonel.aktif ? "Aktif" : "Pasif"}
                    </span>
                  </div>
                  <div className="personel-detail-item personel-detail-item--full">
                    <span className="personel-detail-label">İşe Giriş</span>
                    <span className="personel-detail-value">{detailPersonel.ise_giris_tarihi}</span>
                  </div>
                  <div className="personel-detail-item">
                    <span className="personel-detail-label">Maaş Tipi</span>
                    <span className="personel-detail-value">{getMaasTipiLabel(detailPersonel.maas_tipi || "saatli")}</span>
                  </div>
                  <div className="personel-detail-item">
                    <span className="personel-detail-label">Çalışma Tipi</span>
                    <span className="personel-detail-value">{getCalismaTipiLabel(detailPersonel.calisma_tipi || "full_time")}</span>
                  </div>
                </div>
                {userProfile && userProfile.is_admin && (
                <div className="personel-detail-actions">
                  <button
                    type="button"
                    className={`btn-toggle-status${detailPersonel.aktif ? " btn-toggle-status--deactivate" : " btn-toggle-status--activate"}`}
                    onClick={() => {
                      handleToggleStatus(detailPersonel.kullanici_id, detailPersonel.aktif);
                      setDetailPersonel(null);
                    }}
                  >
                    {detailPersonel.aktif ? "Pasif Yap" : "Aktif Yap"}
                  </button>
                  <button type="button" className="btn-primary" onClick={() => openEditPersonel(detailPersonel)}>
                    Düzenle
                  </button>
                  <button
                    type="button"
                    className="btn-ghost personel-delete-btn"
                    onClick={() => {
                      handleDeleteWithUndo(detailPersonel.kullanici_id);
                      setDetailPersonel(null);
                    }}
                  >
                    Sil
                  </button>
                </div>
                )}
              </div>
            )}
          </Modal>

          <Modal
            open={isMobileViewport && !!editingId}
            onClose={closeEditPersonel}
            title="Personel Düzenle"
            zIndex={1100}
          >
            {editingId && renderEditFormFields(handleEditSubmit, closeEditPersonel)}
          </Modal>
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
