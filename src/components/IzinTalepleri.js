import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { format, differenceInCalendarDays } from "date-fns";
import { tr as trLocale } from "date-fns/locale";

export default function IzinTalepleri() {
  const [talepler, setTalepler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("tumu");
  const [listMonth, setListMonth] = useState(new Date().getMonth() + 1);
  const [listYear, setListYear] = useState(new Date().getFullYear());
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // Alt sekme: 'talepler' veya 'ozet'
  const [activeSubTab, setActiveSubTab] = useState("talepler");

  // Form state
  const [formBaslangic, setFormBaslangic] = useState("");
  const [formBitis, setFormBitis] = useState("");
  const [formIzinTipi, setFormIzinTipi] = useState("");
  const [formAciklama, setFormAciklama] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Toplu işlem state
  const [selectedIds, setSelectedIds] = useState([]);

  // Yıllık özet tablosu state
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());
  const [summaryData, setSummaryData] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [personelList, setPersonelList] = useState([]);
  const [personelFilter, setPersonelFilter] = useState("aktif"); // aktif, pasif, tumu
  const [myLeaveSummary, setMyLeaveSummary] = useState(null);

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
      
      // Normal kullanıcı ise kalan izin bilgisini çek
      if (!userProfile.is_admin) {
        loadMySummary();
      }
    }
  }, [userProfile, filter, listMonth, listYear]); // eslint-disable-line react-hooks/exhaustive-deps

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

      if (!userProfile?.is_admin) {
        query = query.eq("kullanici_id", userProfile.kullanici_id);
      }

      if (filter !== "tumu") {
        query = query.eq("durum", filter);
      }

      // Tarih filtresi uygula
      const startDate = `${listYear}-${String(listMonth).padStart(2, '0')}-01`;
      const endDate = new Date(listYear, listMonth, 0); // O ayın son günü
      const endDateString = `${listYear}-${String(listMonth).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}T23:59:59`;
      
      query = query.gte("talep_tarihi", startDate).lte("talep_tarihi", endDateString);

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

    if (formBitis <= formBaslangic) {
      setFormError("Bitiş tarihi başlangıç tarihinden sonra olmalıdır.");
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
        if (not === null) return;
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
        if (userProfile?.is_admin) loadSummaryData();
      }
    } catch (err) {
      alert(String(err.message || err));
    }
  }

  // ---- Toplu işlem fonksiyonları ----
  async function bulkUpdateDurum(yeniDurum) {
    if (selectedIds.length === 0) {
      alert("Lütfen en az bir talep seçin.");
      return;
    }

    let not = null;
    if (yeniDurum === "reddedildi") {
      not = prompt("Seçili " + selectedIds.length + " talep için red nedeni:");
      if (not === null) return;
    } else if (yeniDurum === "onaylandi") {
      not = prompt("Seçili " + selectedIds.length + " talep için onay notu (opsiyonel):");
      if (not === null) return;
    }

    try {
      const updateData = {
        durum: yeniDurum,
        karar_tarihi: new Date().toISOString(),
      };
      if (not) updateData.admin_notu = not;

      const { error: updateError } = await supabase
        .from("izin_talepleri")
        .update(updateData)
        .in("id", selectedIds);

      if (updateError) {
        alert(updateError.message || "Toplu güncelleme başarısız");
      } else {
        setSelectedIds([]);
        loadTalepler();
        loadSummaryData();
      }
    } catch (err) {
      alert(String(err.message || err));
    }
  }

  function toggleSelect(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    const selectableTalepler = talepler.filter(
      t => t.durum === "beklemede"
    );

    if (selectableTalepler.length === 0) return;

    if (selectedIds.length === selectableTalepler.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableTalepler.map((t) => t.id));
    }
  }

  async function loadMySummary() {
    try {
      const { data, error } = await supabase.rpc('get_personel_leave_summary');
      if (!error && data) {
        const myData = data.find(d => d.kullanici_id === userProfile.kullanici_id);
        if (myData) {
          const iseGiris = new Date(myData.ise_giris_tarihi);
          let yearsEmployed = Math.floor(differenceInCalendarDays(new Date(), iseGiris) / 365.25);
          if (isNaN(yearsEmployed) || yearsEmployed < 0) yearsEmployed = 0;
          
          const earnedBlocks = Math.min(yearsEmployed, Math.floor((myData.total_working_days || 0) / 300));
          const totalEarned = earnedBlocks * 14;
          const devreden = myData.devreden_yillik_izin || 0;
          const usedTotal = myData.used_leave || 0;
          const remaining = totalEarned + devreden - usedTotal;
          
          setMyLeaveSummary({
            totalEarned,
            devreden,
            usedTotal,
            remaining,
            totalDays: myData.total_working_days || 0,
            yearsEmployed
          });
        }
      }
    } catch(err) {
      console.error("Kalan izin hesaplanırken hata:", err);
    }
  }

  // ---- Özet tablosu fonksiyonları ----
  async function loadPersonelList() {
    try {
      const { data, error } = await supabase.rpc('get_personel_leave_summary');
      if (error) throw error;
      setPersonelList(data || []);
    } catch (err) {
      console.error("Personel listesi ve izin bilgileri yükleme hatası:", err);
    }
  }

  async function handleEditDevreden(kullanici_id, mevcutDevreden, isim, soyisim) {
    const adSoyad = `${isim} ${soyisim || ""}`.trim();
    const newValStr = prompt(`${adSoyad} için geçmiş seneden devreden yıllık izin gün sayısını girin:\n(Mevcut: ${mevcutDevreden || 0})`, mevcutDevreden || 0);
    if (newValStr === null) return;
    
    const newVal = parseInt(newValStr);
    if (isNaN(newVal)) return alert("Lütfen geçerli bir sayı girin.");
    
    try {
      const { error } = await supabase
        .from("personel")
        .update({ devreden_yillik_izin: newVal })
        .eq("kullanici_id", kullanici_id);
        
      if (error) {
        alert("Güncellenemedi: " + error.message);
      } else {
        loadPersonelList(); // Listeyi RPC'den tazelemek için
      }
    } catch(err) {
      alert("Beklenmeyen hata: " + err.message);
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

  // Bitiş tarihi eksklüsif: 4→5 = 1 gün (sadece 4. gün izinli)
  function calculateDaysInMonth(baslangic, bitis, year, month) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0); // Ayın son günü
    const izinStart = new Date(baslangic);
    // Bitiş eksklüsif: son izin günü = bitis - 1
    const izinLastDay = new Date(bitis);
    izinLastDay.setDate(izinLastDay.getDate() - 1);

    const effectiveStart = izinStart > monthStart ? izinStart : monthStart;
    const effectiveEnd = izinLastDay < monthEnd ? izinLastDay : monthEnd;

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
      
      const iseGiris = new Date(p.ise_giris_tarihi);
      let yearsEmployed = Math.floor(differenceInCalendarDays(new Date(), iseGiris) / 365.25);
      if (isNaN(yearsEmployed) || yearsEmployed < 0) yearsEmployed = 0;
      
      const totalDays = p.total_working_days || 0;
      const earnedBlocks = Math.min(yearsEmployed, Math.floor(totalDays / 300));
      const totalEarned = earnedBlocks * 14;
      const devreden = p.devreden_yillik_izin || 0;
      const usedTotal = p.used_leave || 0;
      const remaining = totalEarned + devreden - usedTotal;

      return {
        kullanici_id: p.kullanici_id,
        isim: p.isim,
        soyisim: p.soyisim,
        aktif: true, // RPC is only fetching active users right now based on our query
        months,
        totalEarned,
        devreden,
        usedTotal,
        remaining,
        yearsEmployed,
        totalDays
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
    if (m.yillik > 0) parts.push(m.yillik + "(YILLIK)");
    if (m.raporlu > 0) parts.push(m.raporlu + "(RAPOR)");
    if (m.ucretsiz > 0) parts.push(m.ucretsiz + "(ÜCRETSİZ)");
    return parts.length > 0 ? parts.join(" ") : "";
  }

  // Başlangıç tarihi seçilince bitiş min değerini hesapla
  function getMinBitis() {
    if (!formBaslangic) return "";
    const d = new Date(formBaslangic);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }

  // İzin gün sayısını göster (bitiş eksklüsif)
  function getIzinGunSayisi() {
    if (!formBaslangic || !formBitis) return null;
    const days = differenceInCalendarDays(new Date(formBitis), new Date(formBaslangic));
    if (days <= 0) return null;
    return days;
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

  const izinGunSayisi = getIzinGunSayisi();

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
                  onChange={(e) => {
                    setFormBaslangic(e.target.value);
                    // Bitiş tarihi başlangıçtan küçük veya eşitse temizle
                    if (formBitis && formBitis <= e.target.value) {
                      setFormBitis("");
                    }
                  }}
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
                <label style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                  Bitiş Tarihi *
                  {izinGunSayisi && (
                    <span style={{ fontWeight: "400", color: "#6b7280", marginLeft: "6px" }}>
                      ({izinGunSayisi} gün)
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  value={formBitis}
                  onChange={(e) => setFormBitis(e.target.value)}
                  min={getMinBitis()}
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

      {/* Alt Sekme Butonları */}
      {userProfile.is_admin && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <button
            onClick={() => setActiveSubTab("talepler")}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: "600",
              backgroundColor: activeSubTab === "talepler" ? "#3b82f6" : "#f3f4f6",
              color: activeSubTab === "talepler" ? "white" : "#374151",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            📋 İzin Talepleri
          </button>
          <button
            onClick={() => setActiveSubTab("ozet")}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: "600",
              backgroundColor: activeSubTab === "ozet" ? "#16a34a" : "#f3f4f6",
              color: activeSubTab === "ozet" ? "white" : "#374151",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            📊 Yıllık İzin Özet Tablosu
          </button>
        </div>
      )}

      {/* ========== İZİN TALEPLERİ BÖLÜMÜ ========== */}
      {(activeSubTab === "talepler" || !userProfile.is_admin) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Çalışan İçin Kalan İzin Kartı */}
          {!userProfile.is_admin && myLeaveSummary && (
            <div style={{
              padding: "16px",
              backgroundColor: "white",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
              flexWrap: "wrap",
              gap: "16px"
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", color: "#374151" }}>Yıllık İzin Bakiyeniz</h3>
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                  Hak Edilen: <b>{myLeaveSummary.totalEarned}</b> | Devreden: <b>{myLeaveSummary.devreden}</b> | Kullanılan: <b style={{ color: "red" }}>{myLeaveSummary.usedTotal}</b>
                </div>
                <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                  Fiili çalışma günü: {myLeaveSummary.totalDays} | Kıdem: {myLeaveSummary.yearsEmployed} Yıl
                </div>
              </div>
              <div style={{
                backgroundColor: myLeaveSummary.remaining > 0 ? "#ecfdf5" : "#fef2f2",
                border: `2px solid ${myLeaveSummary.remaining > 0 ? "#10b981" : "#ef4444"}`,
                borderRadius: "8px",
                padding: "12px 24px",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: myLeaveSummary.remaining > 0 ? "#059669" : "#b91c1c", textTransform: "uppercase" }}>
                  Kalan İzin
                </div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: myLeaveSummary.remaining > 0 ? "#047857" : "#991b1b" }}>
                  {myLeaveSummary.remaining} <span style={{ fontSize: "14px", fontWeight: "normal" }}>Gün</span>
                </div>
              </div>
            </div>
          )}

          {/* Filtre */}
          <div style={{ marginBottom: "16px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: "500", color: "#374151" }}>Ay:</span>
              <select
                value={listMonth}
                onChange={(e) => setListMonth(parseInt(e.target.value))}
                style={{ padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                  <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('tr-TR', { month: 'long' })}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: "500", color: "#374151" }}>Yıl:</span>
              <select
                value={listYear}
                onChange={(e) => setListYear(parseInt(e.target.value))}
                style={{ padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }}
              >
                {[...Array(5)].map((_, i) => {
                  const year = new Date().getFullYear() - 2 + i;
                  return <option key={year} value={year}>{year}</option>;
                })}
              </select>
            </div>
            
            <div style={{ width: "1px", height: "24px", backgroundColor: "#d1d5db", margin: "0 4px" }}></div>
            
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

          {/* Toplu İşlem Çubuğu - Admin */}
          {userProfile.is_admin && selectedIds.length > 0 && (
            <div style={{
              marginBottom: "12px",
              padding: "12px 16px",
              backgroundColor: "#eff6ff",
              border: "1px solid #3b82f6",
              borderRadius: "8px",
              display: "flex",
              gap: "12px",
              alignItems: "center",
              flexWrap: "wrap",
            }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#1e40af" }}>
                {selectedIds.length} talep seçildi
              </span>
              <button
                onClick={() => bulkUpdateDurum("onaylandi")}
                style={{
                  padding: "6px 14px", fontSize: "13px", backgroundColor: "#10b981",
                  color: "white", border: "none", borderRadius: "6px", cursor: "pointer",
                  fontWeight: "500", transition: "all 0.2s",
                }}
              >
                Onayla
              </button>
              <button
                onClick={() => bulkUpdateDurum("reddedildi")}
                style={{
                  padding: "6px 14px", fontSize: "13px", backgroundColor: "#ef4444",
                  color: "white", border: "none", borderRadius: "6px", cursor: "pointer",
                  fontWeight: "500", transition: "all 0.2s",
                }}
              >
                Reddet
              </button>
              <button
                onClick={() => setSelectedIds([])}
                style={{
                  padding: "6px 14px", fontSize: "13px", backgroundColor: "#6b7280",
                  color: "white", border: "none", borderRadius: "6px", cursor: "pointer",
                  fontWeight: "500", transition: "all 0.2s",
                }}
              >
                Seçimi Temizle
              </button>
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
                        padding: "16px 8px", textAlign: "center",
                        borderBottom: "2px solid #e5e7eb", width: "40px",
                      }}>
                        <input
                          type="checkbox"
                          disabled={talepler.filter(t => t.durum === "beklemede").length === 0}
                          checked={
                            talepler.filter(t => t.durum === "beklemede").length > 0 &&
                            selectedIds.length === talepler.filter(t => t.durum === "beklemede").length
                          }
                          onChange={toggleSelectAll}
                          style={{ 
                            cursor: talepler.filter(t => t.durum === "beklemede").length === 0 ? "not-allowed" : "pointer", 
                            width: "16px", height: "16px" 
                          }}
                        />
                      </th>
                    )}
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
                    }}>Gün</th>
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
                  {talepler.map((talep) => {
                    const gunSayisi = differenceInCalendarDays(
                      new Date(talep.bitis_tarihi), new Date(talep.baslangic_tarihi)
                    );
                    return (
                      <tr key={talep.id} style={{
                        borderBottom: "1px solid rgb(0, 0, 0)",
                        transition: "background-color 0.2s",
                        backgroundColor: selectedIds.includes(talep.id) ? "#eff6ff" : "white",
                      }}>
                        {userProfile.is_admin && (
                          <td style={{ padding: "16px 8px", textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(talep.id)}
                              onChange={() => toggleSelect(talep.id)}
                              disabled={talep.durum !== "beklemede"}
                              style={{ 
                                cursor: talep.durum !== "beklemede" ? "not-allowed" : "pointer", 
                                width: "16px", height: "16px",
                                opacity: talep.durum !== "beklemede" ? 0.4 : 1
                              }}
                            />
                          </td>
                        )}
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
                        <td style={{ padding: "16px 12px", fontSize: "14px", color: "#374151", fontWeight: "600" }}>
                          {gunSayisi > 0 ? gunSayisi : "-"}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========== YILLIK İZİN ÖZET TABLOSU ========== */}
      {userProfile.is_admin && activeSubTab === "ozet" && (
        <div>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: "16px", flexWrap: "wrap", gap: "12px",
          }}>
            <h3 style={{ margin: 0, fontSize: "18px", color: "#166534", fontWeight: "700" }}>
              📊 Yıllık İzin Özet Tablosu
            </h3>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {[
                  { value: "aktif", label: "Aktif" },
                  { value: "pasif", label: "Pasif" },
                  { value: "tumu", label: "Tümü" },
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setPersonelFilter(f.value)}
                    style={{
                      padding: "6px 12px", fontSize: "13px",
                      backgroundColor: personelFilter === f.value ? "#16a34a" : "#f3f4f6",
                      color: personelFilter === f.value ? "white" : "#374151",
                      border: "1px solid #d1d5db", borderRadius: "6px",
                      cursor: "pointer", fontWeight: "500", transition: "all 0.2s",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
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
                    <th style={{
                      padding: "10px 8px", textAlign: "center", fontWeight: "700",
                      backgroundColor: "#e0e7ff", color: "#3730a3",
                      border: "1px solid #c7d2fe", whiteSpace: "nowrap",
                    }} title="1 yıl kıdem + 300 gün işe gelme">HAK EDİLEN</th>
                    <th style={{
                      padding: "10px 8px", textAlign: "center", fontWeight: "700",
                      backgroundColor: "#e0e7ff", color: "#3730a3",
                      border: "1px solid #c7d2fe", whiteSpace: "nowrap",
                    }}>DEVREDEN</th>
                    <th style={{
                      padding: "10px 8px", textAlign: "center", fontWeight: "700",
                      backgroundColor: "#fee2e2", color: "#991b1b",
                      border: "1px solid #fecaca", whiteSpace: "nowrap",
                    }}>KULLANILAN</th>
                    <th style={{
                      padding: "10px 8px", textAlign: "center", fontWeight: "700",
                      backgroundColor: "#d1fae5", color: "#065f46",
                      border: "1px solid #a7f3d0", whiteSpace: "nowrap",
                    }}>KALAN İZİN</th>
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
                  {summaryRows.filter((row) => {
                    if (personelFilter === "aktif") return row.aktif !== false;
                    if (personelFilter === "pasif") return row.aktif === false;
                    return true;
                  }).map((row) => (
                    <tr key={row.kullanici_id}>
                      <td style={{
                        padding: "8px 12px", fontWeight: "700", textAlign: "center",
                        border: "1px solid #16a34a", backgroundColor: "#f0fdf4",
                        color: row.aktif === false ? "#dc2626" : "#166534",
                        whiteSpace: "nowrap", position: "sticky", left: 0, zIndex: 1,
                      }}>
                        {(row.isim || "").toUpperCase()} {(row.soyisim || "").toUpperCase()}
                      </td>
                      <td style={{ padding: "8px 6px", textAlign: "center", border: "1px solid #c7d2fe", backgroundColor: "#eef2ff", fontWeight: "600", color: "#3730a3" }}>
                        {row.totalEarned}
                      </td>
                      <td style={{ padding: "8px 6px", textAlign: "center", border: "1px solid #c7d2fe", backgroundColor: "#eef2ff", fontWeight: "600", color: "#2563eb", cursor: "pointer", textDecoration: "underline" }}
                          onClick={() => handleEditDevreden(row.kullanici_id, row.devreden, row.isim, row.soyisim)}
                          title="Geçmiş seneden devreden izni düzenlemek için tıklayın">
                        {row.devreden}
                      </td>
                      <td style={{ padding: "8px 6px", textAlign: "center", border: "1px solid #fecaca", backgroundColor: "#fef2f2", fontWeight: "600", color: "#991b1b" }}>
                        {row.usedTotal}
                      </td>
                      <td style={{ padding: "8px 6px", textAlign: "center", border: "1px solid #a7f3d0", backgroundColor: "#ecfdf5", fontWeight: "bold", fontSize: "14px", color: "#064e3b" }}>
                        {row.remaining}
                      </td>
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map((ay) => {
                        const m = row.months[ay];
                        const content = renderCellContent(m);
                        const hasData = content !== "";
                        return (
                          <td key={ay} style={{
                            padding: "8px 6px", textAlign: "center",
                            border: "1px solid #16a34a",
                            backgroundColor: "#f0fdf4",
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
