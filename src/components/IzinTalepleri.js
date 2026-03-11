import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { format, differenceInCalendarDays } from "date-fns";
import { tr as trLocale } from "date-fns/locale";

export default function IzinTalepleri() {
  const [talepler, setTalepler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("tumu");
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // Form state
  const [formBaslangic, setFormBaslangic] = useState("");
  const [formBitis, setFormBitis] = useState("");
  const [formIzinTipi, setFormIzinTipi] = useState("");
  const [formAciklama, setFormAciklama] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Yıllık özet tablosu state
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());
  const [summaryData, setSummaryData] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [personelList, setPersonelList] = useState([]);

  const izinTipleri = [
    { value: "ucretsiz_izin", label: "Ücretsiz İzin" },
    { value: "raporlu", label: "Raporlu" },
    { value: "yillik_izin", label: "Yıllık İzin" },
  ];

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

        let { data } = await supabase
          .from("kullanici_profilleri")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        if (data) {
          setUserProfile(data);
        } else {
          const { data: authUser } = await supabase.auth.getUser();

          if (authUser?.user?.id) {
            const adminCheck = await supabase
              .from("admin_users")
              .select("user_id")
              .eq("user_id", authUser.user.id)
              .maybeSingle();

            if (adminCheck.data) {
              const tempAdminProfile = {
                id: -1,
                kullanici_id: null,
                email: email,
                isim: "Admin",
                soyisim: "Kullanıcı",
                is_admin: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
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

  // Talepleri yükle
  useEffect(() => {
    if (userProfile) {
      loadTalepler();
    }
  }, [userProfile, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Özet tablosu verilerini yükle (admin)
  useEffect(() => {
    if (userProfile?.is_admin) {
      loadPersonelList();
      loadSummaryData();
    }
  }, [userProfile, summaryYear]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTalepler() {
    setLoading(true);
    setError("");
    try {
      let query = supabase
        .from("izin_talepleri")
        .select("*")
        .order("talep_tarihi", { ascending: false });

      // Normal kullanıcı sadece kendi taleplerini görebilir
      if (!userProfile?.is_admin) {
        query = query.eq("kullanici_id", userProfile.kullanici_id);
      }

      if (filter !== "tumu") {
        query = query.eq("durum", filter);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(fetchError.message || "Veriler yüklenemedi");
        setTalepler([]);
      } else {
        setTalepler(data || []);
      }
    } catch (err) {
      setError(String(err.message || err));
      setTalepler([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formIzinTipi || !formBaslangic || !formBitis) {
      setFormError("Lütfen izin tipi ve tarih aralığını doldurun.");
      return;
    }

    if (formBitis < formBaslangic) {
      setFormError("Bitiş tarihi başlangıç tarihinden önce olamaz.");
      return;
    }

    setFormLoading(true);
    setFormError("");

    try {
      const { error: insertError } = await supabase
        .from("izin_talepleri")
        .insert({
          kullanici_id: userProfile.kullanici_id,
          calisan_adi: `${userProfile.isim || ""} ${userProfile.soyisim || ""}`.trim(),
          izin_tipi: formIzinTipi,
          baslangic_tarihi: formBaslangic,
          bitis_tarihi: formBitis,
          aciklama: formAciklama.trim() || null,
          durum: "beklemede",
          talep_tarihi: new Date().toISOString(),
        });

      if (insertError) {
        setFormError(insertError.message || "İzin talebi gönderilemedi");
      } else {
        setFormBaslangic("");
        setFormBitis("");
        setFormIzinTipi("");
        setFormAciklama("");
        alert("İzin talebiniz başarıyla gönderildi. Admin onayı bekleniyor.");
        loadTalepler();
      }
    } catch (err) {
      setFormError(String(err.message || err));
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDurumGuncelle(id, yeniDurum) {
    try {
      const updateData = {
        durum: yeniDurum,
        karar_tarihi: new Date().toISOString(),
      };

      if (yeniDurum === "reddedildi") {
        const not = prompt("Red nedeni:");
        if (not === null) return; // İptal edildi
        updateData.admin_notu = not;
      }

      if (yeniDurum === "onaylandi") {
        const not = prompt("Onay notu (opsiyonel):");
        if (not === null) return;
        if (not) updateData.admin_notu = not;
      }

      const { error: updateError } = await supabase
        .from("izin_talepleri")
        .update(updateData)
        .eq("id", id);

      if (updateError) {
        alert(updateError.message || "Durum güncellenemedi");
      } else {
        loadTalepler();
      }
    } catch (err) {
      alert(String(err.message || err));
    }
  }

  async function loadPersonelList() {
    try {
      const { data } = await supabase
        .from("personel")
        .select("kullanici_id, isim, soyisim, aktif")
        .order("isim", { ascending: true });
      setPersonelList(data || []);
    } catch (err) {
      console.error("Personel listesi yükleme hatası:", err);
    }
  }

  async function loadSummaryData() {
    setSummaryLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from("izin_talepleri")
        .select("*")
        .eq("durum", "onaylandi")
        .gte("baslangic_tarihi", `${summaryYear}-01-01`)
        .lte("bitis_tarihi", `${summaryYear}-12-31`);

      if (fetchErr) {
        console.error("Özet veri yükleme hatası:", fetchErr);
        setSummaryData([]);
      } else {
        setSummaryData(data || []);
      }
    } catch (err) {
      console.error("Özet veri yükleme hatası:", err);
      setSummaryData([]);
    } finally {
      setSummaryLoading(false);
    }
  }

  // Ay bazlı gün sayısı hesaplama
  function calculateDaysInMonth(baslangic, bitis, year, month) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0); // Ayın son günü
    const izinStart = new Date(baslangic);
    const izinEnd = new Date(bitis);

    const effectiveStart = izinStart > monthStart ? izinStart : monthStart;
    const effectiveEnd = izinEnd < monthEnd ? izinEnd : monthEnd;

    if (effectiveStart > effectiveEnd) return 0;
    return differenceInCalendarDays(effectiveEnd, effectiveStart) + 1;
  }

  // Özet tablo verilerini hesapla
  const summaryRows = useMemo(() => {
    const aylar = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    return personelList.map((p) => {
      const kisiTalepleri = summaryData.filter((t) => t.kullanici_id === p.kullanici_id);
      const months = {};

      aylar.forEach((ay) => {
        let yillik = 0;
        let raporlu = 0;
        let ucretsiz = 0;

        kisiTalepleri.forEach((t) => {
          const gun = calculateDaysInMonth(t.baslangic_tarihi, t.bitis_tarihi, summaryYear, ay);
          if (gun > 0) {
            if (t.izin_tipi === "yillik_izin") yillik += gun;
            else if (t.izin_tipi === "raporlu") raporlu += gun;
            else if (t.izin_tipi === "ucretsiz_izin") ucretsiz += gun;
          }
        });

        months[ay] = { yillik, raporlu, ucretsiz };
      });

      return {
        kullanici_id: p.kullanici_id,
        isim: p.isim,
        soyisim: p.soyisim,
        aktif: p.aktif,
        months,
      };
    });
  }, [personelList, summaryData, summaryYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const ayIsimleri = ["OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN",
    "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK"];

  const summaryYears = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  function getIzinTipiLabel(tip) {
    const t = izinTipleri.find((x) => x.value === tip);
    return t ? t.label : tip;
  }

  function getDurumColor(durum) {
    switch (durum) {
      case "beklemede": return "#f59e0b";
      case "onaylandi": return "#10b981";
      case "reddedildi": return "#ef4444";
      default: return "#6b7280";
    }
  }

  function getDurumLabel(durum) {
    switch (durum) {
      case "beklemede": return "Beklemede";
      case "onaylandi": return "Onaylandı";
      case "reddedildi": return "Reddedildi";
      default: return durum;
    }
  }

  function renderCellContent(m) {
    const parts = [];
    if (m.yillik > 0) parts.push(String(m.yillik));
    if (m.raporlu > 0) parts.push(m.raporlu + "(RAPOR)");
    if (m.ucretsiz > 0) parts.push(m.ucretsiz + "(ÜCRETSİZ)");
    return parts.length > 0 ? parts.join(" ") : "";
  }

  // Giriş yapılmamışsa uyarı göster
  if (!session) {
    return (
      <div>
        <h2>İzin Talepleri</h2>
        <div style={{
          padding: "12px",
          backgroundColor: "#fef3c7",
          border: "1px solid #f59e0b",
          borderRadius: "6px",
          marginBottom: "12px",
        }}>
          <div style={{ fontSize: "14px", color: "#92400e", fontWeight: "500", marginBottom: "4px" }}>
            🔒 Giriş Gerekli
          </div>
          <div style={{ fontSize: "13px", color: "#92400e" }}>
            İzin taleplerini görüntülemek için lütfen önce hesap oluşturun veya giriş yapın.
          </div>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div>
        <h2>İzin Talepleri</h2>
        <div style={{
          padding: "12px",
          backgroundColor: "#fee2e2",
          border: "1px solid #ef4444",
          borderRadius: "6px",
        }}>
          <div style={{ fontSize: "14px", color: "#991b1b", fontWeight: "600", marginBottom: "4px" }}>
            Profil Bulunamadı
          </div>
          <div style={{ fontSize: "13px", color: "#991b1b" }}>
            Bu hesap için profil kaydı bulunamadı. Lütfen yöneticinizle iletişime geçin.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>İzin Talepleri</h2>

      {/* Normal kullanıcı için izin talebi formu */}
      {!userProfile.is_admin && (
        <div style={{
          marginBottom: "24px",
          padding: "20px",
          backgroundColor: "#f9fafb",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
        }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", color: "#374151" }}>
            Yeni İzin Talebi
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>İzin Tipi *</label>
                <select
                  value={formIzinTipi}
                  onChange={(e) => setFormIzinTipi(e.target.value)}
                  required
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                    backgroundColor: "white",
                    minWidth: "180px",
                  }}
                >
                  <option value="">Seçin...</option>
                  {izinTipleri.map((tip) => (
                    <option key={tip.value} value={tip.value}>
                      {tip.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>Başlangıç Tarihi *</label>
                <input
                  type="date"
                  value={formBaslangic}
                  onChange={(e) => setFormBaslangic(e.target.value)}
                  required
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                    backgroundColor: "white",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>Bitiş Tarihi *</label>
                <input
                  type="date"
                  value={formBitis}
                  onChange={(e) => setFormBitis(e.target.value)}
                  required
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                    backgroundColor: "white",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: "200px" }}>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>Açıklama</label>
                <input
                  type="text"
                  value={formAciklama}
                  onChange={(e) => setFormAciklama(e.target.value)}
                  placeholder="İsteğe bağlı açıklama..."
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                    backgroundColor: "white",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={formLoading}
                style={{
                  padding: "8px 20px",
                  fontSize: "14px",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: formLoading ? "not-allowed" : "pointer",
                  fontWeight: "500",
                  transition: "all 0.2s",
                  boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                  opacity: formLoading ? 0.6 : 1,
                }}
                onMouseEnter={(e) => { if (!formLoading) { e.target.style.backgroundColor = "#2563eb"; e.target.style.transform = "translateY(-1px)"; } }}
                onMouseLeave={(e) => { e.target.style.backgroundColor = "#3b82f6"; e.target.style.transform = "translateY(0)"; }}
              >
                {formLoading ? "Gönderiliyor..." : "Talep Gönder"}
              </button>
            </div>

            {formError && (
              <div style={{ color: "#dc2626", marginTop: "8px", fontSize: "14px" }}>
                {formError}
              </div>
            )}
          </form>
        </div>
      )}

      {/* Filtre */}
      <div style={{ marginBottom: "16px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "14px", fontWeight: "500", color: "#374151" }}>Durum:</span>
        {[
          { value: "tumu", label: "Tümü", color: "#3b82f6" },
          { value: "beklemede", label: "Beklemede", color: "#f59e0b" },
          { value: "onaylandi", label: "Onaylandı", color: "#10b981" },
          { value: "reddedildi", label: "Reddedildi", color: "#ef4444" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: "6px 12px",
              fontSize: "13px",
              backgroundColor: filter === f.value ? f.color : "#f3f4f6",
              color: filter === f.value ? "white" : "#374151",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "500",
              transition: "all 0.2s",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Admin bilgi */}
      {userProfile.is_admin && (
        <div style={{
          padding: "12px",
          backgroundColor: "#dcfce7",
          border: "1px solid #10b981",
          borderRadius: "6px",
          marginBottom: "12px",
        }}>
          <div style={{ fontSize: "14px", color: "#166534", fontWeight: "500", marginBottom: "4px" }}>
            👑 Admin Görünümü
          </div>
          <div style={{ fontSize: "13px", color: "#166534" }}>
            Tüm çalışanların izin taleplerini görebilir, onaylayabilir veya reddedebilirsiniz.
          </div>
        </div>
      )}

      {/* Talepler Tablosu */}
      {loading ? (
        <div>Yükleniyor...</div>
      ) : error ? (
        <div style={{ color: "red" }}>{error}</div>
      ) : talepler.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
          {filter === "tumu" ? "Henüz izin talebi yok." : `${getDurumLabel(filter)} durumunda talep yok.`}
        </div>
      ) : (
        <div style={{
          overflowX: "auto",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
        }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            backgroundColor: "white",
            fontSize: "14px",
          }}>
            <thead>
              <tr style={{ backgroundColor: "#f9fafb" }}>
                {userProfile.is_admin && (
                  <th style={{
                    padding: "16px 12px", textAlign: "left", fontSize: "14px",
                    fontWeight: "600", color: "#374151", borderBottom: "2px solid #e5e7eb",
                  }}>Çalışan</th>
                )}
                <th style={{
                  padding: "16px 12px", textAlign: "left", fontSize: "14px",
                  fontWeight: "600", color: "#374151", borderBottom: "2px solid #e5e7eb",
                }}>İzin Tipi</th>
                <th style={{
                  padding: "16px 12px", textAlign: "left", fontSize: "14px",
                  fontWeight: "600", color: "#374151", borderBottom: "2px solid #e5e7eb",
                }}>Başlangıç</th>
                <th style={{
                  padding: "16px 12px", textAlign: "left", fontSize: "14px",
                  fontWeight: "600", color: "#374151", borderBottom: "2px solid #e5e7eb",
                }}>Bitiş</th>
                <th style={{
                  padding: "16px 12px", textAlign: "left", fontSize: "14px",
                  fontWeight: "600", color: "#374151", borderBottom: "2px solid #e5e7eb",
                }}>Açıklama</th>
                <th style={{
                  padding: "16px 12px", textAlign: "left", fontSize: "14px",
                  fontWeight: "600", color: "#374151", borderBottom: "2px solid #e5e7eb",
                }}>Durum</th>
                <th style={{
                  padding: "16px 12px", textAlign: "left", fontSize: "14px",
                  fontWeight: "600", color: "#374151", borderBottom: "2px solid #e5e7eb",
                }}>Talep Tarihi</th>
                {userProfile.is_admin && (
                  <th style={{
                    padding: "16px 12px", textAlign: "left", fontSize: "14px",
                    fontWeight: "600", color: "#374151", borderBottom: "2px solid #e5e7eb",
                  }}>İşlemler</th>
                )}
              </tr>
            </thead>
            <tbody>
              {talepler.map((talep) => (
                <tr key={talep.id} style={{
                  borderBottom: "1px solid rgb(0, 0, 0)",
                  transition: "background-color 0.2s",
                }}>
                  {userProfile.is_admin && (
                    <td style={{ padding: "16px 12px", fontSize: "14px", color: "#374151" }}>
                      <div>{talep.calisan_adi}</div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>ID: {talep.kullanici_id}</div>
                    </td>
                  )}
                  <td style={{ padding: "16px 12px", fontSize: "14px", color: "#374151" }}>
                    <span style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "500",
                      backgroundColor: talep.izin_tipi === "yillik_izin" ? "#dbeafe" :
                        talep.izin_tipi === "raporlu" ? "#fef3c7" : "#f3e8ff",
                      color: talep.izin_tipi === "yillik_izin" ? "#1e40af" :
                        talep.izin_tipi === "raporlu" ? "#92400e" : "#6b21a8",
                    }}>
                      {getIzinTipiLabel(talep.izin_tipi)}
                    </span>
                  </td>
                  <td style={{ padding: "16px 12px", fontSize: "14px", color: "#374151" }}>
                    {format(new Date(talep.baslangic_tarihi), "dd MMM yyyy", { locale: trLocale })}
                  </td>
                  <td style={{ padding: "16px 12px", fontSize: "14px", color: "#374151" }}>
                    {format(new Date(talep.bitis_tarihi), "dd MMM yyyy", { locale: trLocale })}
                  </td>
                  <td style={{
                    padding: "16px 12px", fontSize: "14px", color: "#374151", maxWidth: "200px",
                  }}>
                    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {talep.aciklama || "-"}
                    </div>
                    {talep.admin_notu && (
                      <div style={{
                        marginTop: "8px", padding: "8px", backgroundColor: "#f0f9ff",
                        borderRadius: "4px", fontSize: "12px", borderLeft: "3px solid #3b82f6",
                      }}>
                        <strong>Admin Notu:</strong> {talep.admin_notu}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "16px 12px", fontSize: "14px", color: "#374151" }}>
                    <span style={{
                      padding: "4px 8px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "white",
                      backgroundColor: getDurumColor(talep.durum),
                    }}>
                      {getDurumLabel(talep.durum)}
                    </span>
                  </td>
                  <td style={{ padding: "16px 12px", fontSize: "14px", color: "#374151" }}>
                    {format(new Date(talep.talep_tarihi), "dd.MM.yyyy HH:mm")}
                  </td>
                  {userProfile.is_admin && (
                    <td style={{ padding: "16px 12px", fontSize: "14px" }}>
                      {talep.durum === "beklemede" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <button
                            onClick={() => handleDurumGuncelle(talep.id, "onaylandi")}
                            style={{
                              padding: "8px 16px", fontSize: "13px", backgroundColor: "#10b981",
                              color: "white", border: "none", borderRadius: "6px", cursor: "pointer",
                              fontWeight: "500", transition: "all 0.2s",
                              boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                            }}
                            onMouseEnter={(e) => { e.target.style.backgroundColor = "#059669"; e.target.style.transform = "translateY(-1px)"; }}
                            onMouseLeave={(e) => { e.target.style.backgroundColor = "#10b981"; e.target.style.transform = "translateY(0)"; }}
                          >
                            Onayla
                          </button>
                          <button
                            onClick={() => handleDurumGuncelle(talep.id, "reddedildi")}
                            style={{
                              padding: "8px 16px", fontSize: "13px", backgroundColor: "#ef4444",
                              color: "white", border: "none", borderRadius: "6px", cursor: "pointer",
                              fontWeight: "500", transition: "all 0.2s",
                              boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                            }}
                            onMouseEnter={(e) => { e.target.style.backgroundColor = "#dc2626"; e.target.style.transform = "translateY(-1px)"; }}
                            onMouseLeave={(e) => { e.target.style.backgroundColor = "#ef4444"; e.target.style.transform = "translateY(0)"; }}
                          >
                            Reddet
                          </button>
                        </div>
                      )}
                      {talep.durum !== "beklemede" && talep.karar_tarihi && (
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>
                          {format(new Date(talep.karar_tarihi), "dd.MM.yyyy HH:mm")}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Yıllık İzin Özet Tablosu - Admin */}
      {userProfile.is_admin && (
        <div style={{ marginTop: "40px" }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: "16px", flexWrap: "wrap", gap: "12px",
          }}>
            <h3 style={{ margin: 0, fontSize: "18px", color: "#166534", fontWeight: "700" }}>
              📊 Yıllık İzin Özet Tablosu
            </h3>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <label style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>Yıl:</label>
              <select
                value={summaryYear}
                onChange={(e) => setSummaryYear(parseInt(e.target.value))}
                style={{
                  padding: "6px 12px", border: "1px solid #16a34a",
                  borderRadius: "6px", fontSize: "14px", backgroundColor: "white",
                }}
              >
                {summaryYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {summaryLoading ? (
            <div>Yükleniyor...</div>
          ) : (
            <div style={{ overflowX: "auto", borderRadius: "4px", border: "2px solid #16a34a" }}>
              <table style={{
                width: "100%", borderCollapse: "collapse", fontSize: "13px",
                minWidth: "1200px",
              }}>
                <thead>
                  <tr>
                    <th style={{
                      padding: "10px 12px", textAlign: "left", fontWeight: "700",
                      backgroundColor: "#dcfce7", color: "#166534",
                      border: "1px solid #16a34a", whiteSpace: "nowrap",
                      position: "sticky", left: 0, zIndex: 1, minWidth: "180px",
                    }}>ADI SOYADI</th>
                    {ayIsimleri.map((ay, i) => (
                      <th key={i} style={{
                        padding: "10px 8px", textAlign: "center", fontWeight: "700",
                        backgroundColor: "#dcfce7", color: "#166534",
                        border: "1px solid #16a34a", whiteSpace: "nowrap",
                        minWidth: "80px",
                      }}>{ay}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row) => (
                    <tr key={row.kullanici_id}>
                      <td style={{
                        padding: "8px 12px", fontWeight: "700", textAlign: "center",
                        border: "1px solid #16a34a", backgroundColor: "#f0fdf4",
                        color: row.aktif === false ? "#dc2626" : "#166534",
                        whiteSpace: "nowrap", position: "sticky", left: 0, zIndex: 1,
                      }}>
                        {(row.isim || "").toUpperCase()} {(row.soyisim || "").toUpperCase()}
                      </td>
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map((ay) => {
                        const m = row.months[ay];
                        const content = renderCellContent(m);
                        const hasData = content !== "";
                        return (
                          <td key={ay} style={{
                            padding: "8px 6px", textAlign: "center",
                            border: "1px solid #16a34a",
                            backgroundColor: hasData ? "#f0fdf4" : "#f0fdf4",
                            color: "#374151", fontSize: "12px", fontWeight: hasData ? "600" : "normal",
                            whiteSpace: "nowrap",
                          }}>
                            {content}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
