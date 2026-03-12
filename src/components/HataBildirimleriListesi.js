import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { format } from "date-fns";
import { tr as trLocale } from "date-fns/locale";

export default function HataBildirimleriListesi() {
  const [bildirimler, setBildirimler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("tumu"); // tumu, beklemede, inceleniyor, cozuldu, reddedildi
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (userProfile) {
      loadBildirimler();
    }
  }, [filter, userProfile, selectedMonth, selectedYear]); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function loadBildirimler() {
    setLoading(true);
    setError("");
    try {
      let query = supabase
        .from("hata_bildirimleri")
        .select("*")
        .order("bildirim_tarihi", { ascending: false });

      // Normal kullanıcı sadece kendi bildirimlerini görebilir
      if (!userProfile?.is_admin && userProfile?.kullanici_id) {
        query = query.eq("kullanici_id", userProfile.kullanici_id);
      }

      if (filter !== "tumu") {
        query = query.eq("durum", filter);
      }

      // Tarih filtresi uygula
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const endDate = new Date(selectedYear, selectedMonth, 0); // O ayın son günü
      const endDateString = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}T23:59:59`;
      
      query = query.gte("bildirim_tarihi", startDate).lte("bildirim_tarihi", endDateString);

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(fetchError.message || "Veriler yüklenemedi");
        setBildirimler([]);
      } else {
        setBildirimler(data || []);
      }
    } catch (err) {
      setError(String(err.message || err));
      setBildirimler([]);
    } finally {
      setLoading(false);
    }
  }

  async function updateDurum(id, yeniDurum, cozumNotu = null) {
    try {
      const updateData = {
        durum: yeniDurum,
        cozum_tarihi: yeniDurum === "cozuldu" || yeniDurum === "reddedildi" ? new Date().toISOString() : null
      };

      if (cozumNotu) {
        updateData.cozum_notu = cozumNotu;
      }

      const { error: updateError } = await supabase
        .from("hata_bildirimleri")
        .update(updateData)
        .eq("id", id);

      if (updateError) {
        alert(updateError.message || "Durum g\u00fcncellenemedi");
      } else {
        loadBildirimler();
      }
    } catch (err) {
      alert(String(err.message || err));
    }
  }

  async function bulkUpdateDurum(yeniDurum) {
    if (selectedIds.length === 0) {
      alert("L\u00fctfen en az bir bildirim se\u00e7in.");
      return;
    }

    let not = null;
    if (yeniDurum === "reddedildi") {
      not = prompt("Se\u00e7ili " + selectedIds.length + " bildirim i\u00e7in red nedeni:");
      if (not === null) return;
    } else if (yeniDurum === "cozuldu") {
      not = prompt("Se\u00e7ili " + selectedIds.length + " bildirim i\u00e7in \u00e7\u00f6z\u00fcm notu (opsiyonel):");
      if (not === null) return;
    }

    try {
      const updateData = {
        durum: yeniDurum,
        cozum_tarihi: new Date().toISOString(),
      };
      if (not) updateData.cozum_notu = not;

      const { error: updateError } = await supabase
        .from("hata_bildirimleri")
        .update(updateData)
        .in("id", selectedIds);

      if (updateError) {
        alert(updateError.message || "Toplu g\u00fcncelleme ba\u015far\u0131s\u0131z");
      } else {
        setSelectedIds([]);
        loadBildirimler();
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
    const selectableBildirimler = bildirimler.filter(
      b => b.durum !== "cozuldu" && b.durum !== "reddedildi"
    );
    
    if (selectableBildirimler.length === 0) return;

    if (selectedIds.length === selectableBildirimler.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableBildirimler.map((b) => b.id));
    }
  }

  function getDurumColor(durum) {
    switch (durum) {
      case "beklemede": return "#f59e0b";
      case "inceleniyor": return "#3b82f6";
      case "cozuldu": return "#10b981";
      case "reddedildi": return "#ef4444";
      default: return "#6b7280";
    }
  }

  function getDurumLabel(durum) {
    switch (durum) {
      case "beklemede": return "Beklemede";
      case "inceleniyor": return "İnceleniyor";
      case "cozuldu": return "Çözüldü";
      case "reddedildi": return "Reddedildi";
      default: return durum;
    }
  }

  function getHataTipiLabel(hataTipi) {
    const hataTipleri = {
      "yanlis_giris": "Yanlış Giriş Saati",
      "yanlis_cikis": "Yanlış Çıkış Saati",
      "eksik_giris": "Giriş Kaydı Eksik",
      "eksik_cikis": "Çıkış Kaydı Eksik",
      "fazla_mesai": "Fazla Mesai Hesaplaması",
      "diger": "Diğer"
    };
    return hataTipleri[hataTipi] || hataTipi;
  }

  if (loading) return <div>Yükleniyor...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;

  // Giriş yapılmamışsa uyarı göster
  if (!session) {
    return (
      <div>
        <h2>Hata Bildirimleri</h2>
        <div style={{
          padding: "12px",
          backgroundColor: "#fef3c7",
          border: "1px solid #f59e0b",
          borderRadius: "6px",
          marginBottom: "12px"
        }}>
          <div style={{ fontSize: "14px", color: "#92400e", fontWeight: "500", marginBottom: "4px" }}>
            🔒 Giriş Gerekli
          </div>
          <div style={{ fontSize: "13px", color: "#92400e" }}>
            Hata bildirimlerini görüntülemek için lütfen önce hesap oluşturun veya giriş yapın.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>Hata Bildirimleri</h2>
      
      <div style={{ marginBottom: "16px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <label style={{ marginRight: "8px", fontWeight: "bold", fontSize: "14px" }}>Ay:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            style={{ padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "14px" }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
              <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('tr-TR', { month: 'long' })}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ marginRight: "8px", fontWeight: "bold", fontSize: "14px" }}>Yıl:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            style={{ padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "14px" }}
          >
            {[...Array(5)].map((_, i) => {
              const year = new Date().getFullYear() - 2 + i;
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
        </div>
        <div>
          <label style={{ marginRight: "8px", fontWeight: "bold", fontSize: "14px" }}>Durum:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: "6px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "4px",
              fontSize: "14px"
            }}
          >
            <option value="tumu">Tümü</option>
            <option value="beklemede">Beklemede</option>
            <option value="inceleniyor">İnceleniyor</option>
            <option value="cozuldu">Çözüldü</option>
            <option value="reddedildi">Reddedildi</option>
          </select>
        </div>
      </div>

      {/* Toplu Islem Cubugu - Sadece Admin */}
      {userProfile?.is_admin && selectedIds.length > 0 && (
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
            {selectedIds.length} bildirim seçildi
          </span>
          <button
            onClick={() => bulkUpdateDurum("inceleniyor")}
            style={{
              padding: "6px 14px", fontSize: "13px", backgroundColor: "#3b82f6",
              color: "white", border: "none", borderRadius: "6px", cursor: "pointer",
              fontWeight: "500", transition: "all 0.2s",
            }}
          >
            İncelemeye Al
          </button>
          <button
            onClick={() => bulkUpdateDurum("cozuldu")}
            style={{
              padding: "6px 14px", fontSize: "13px", backgroundColor: "#10b981",
              color: "white", border: "none", borderRadius: "6px", cursor: "pointer",
              fontWeight: "500", transition: "all 0.2s",
            }}
          >
            Çözüldü
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

      {bildirimler.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
          {filter === "tumu" ? "Henüz hata bildirimi yok." : `${getDurumLabel(filter)} durumunda bildirim yok.`}
        </div>
      ) : (
        <div style={{ 
          overflowX: "auto", 
          borderRadius: "8px", 
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
        }}>
          <table style={{ 
            width: "100%", 
            borderCollapse: "collapse",
            backgroundColor: "white",
            fontSize: "14px"
          }}>
            <thead>
              <tr style={{ backgroundColor: "#f9fafb" }}>
                {userProfile?.is_admin && (
                  <th style={{
                    padding: "16px 8px", textAlign: "center",
                    borderBottom: "2px solid #e5e7eb", width: "40px",
                  }}>
                    <input
                      type="checkbox"
                      disabled={bildirimler.filter(b => b.durum !== "cozuldu" && b.durum !== "reddedildi").length === 0}
                      checked={
                        bildirimler.filter(b => b.durum !== "cozuldu" && b.durum !== "reddedildi").length > 0 &&
                        selectedIds.length === bildirimler.filter(b => b.durum !== "cozuldu" && b.durum !== "reddedildi").length
                      }
                      onChange={toggleSelectAll}
                      style={{ 
                        cursor: bildirimler.filter(b => b.durum !== "cozuldu" && b.durum !== "reddedildi").length === 0 ? "not-allowed" : "pointer", 
                        width: "16px", height: "16px" 
                      }}
                    />
                  </th>
                )}
                <th style={{ 
                  padding: "16px 12px", 
                  textAlign: "left", 
                  fontSize: "14px", 
                  fontWeight: "600", 
                  color: "#374151",
                  borderBottom: "2px solid #e5e7eb"
                }}>Tarih</th>
                <th style={{ 
                  padding: "16px 12px", 
                  textAlign: "left", 
                  fontSize: "14px", 
                  fontWeight: "600", 
                  color: "#374151",
                  borderBottom: "2px solid #e5e7eb"
                }}>Çalışan</th>
                <th style={{ 
                  padding: "16px 12px", 
                  textAlign: "left", 
                  fontSize: "14px", 
                  fontWeight: "600", 
                  color: "#374151",
                  borderBottom: "2px solid #e5e7eb"
                }}>Hata Tipi</th>
                <th style={{ 
                  padding: "16px 12px", 
                  textAlign: "left", 
                  fontSize: "14px", 
                  fontWeight: "600", 
                  color: "#374151",
                  borderBottom: "2px solid #e5e7eb"
                }}>Açıklama</th>
                <th style={{ 
                  padding: "16px 12px", 
                  textAlign: "left", 
                  fontSize: "14px", 
                  fontWeight: "600", 
                  color: "#374151",
                  borderBottom: "2px solid #e5e7eb"
                }}>Durum</th>
                <th style={{ 
                  padding: "16px 12px", 
                  textAlign: "left", 
                  fontSize: "14px", 
                  fontWeight: "600", 
                  color: "#374151",
                  borderBottom: "2px solid #e5e7eb"
                }}>Bildirim Tarihi</th>
                {userProfile?.is_admin && <th style={{ 
                  padding: "16px 12px", 
                  textAlign: "left", 
                  fontSize: "14px", 
                  fontWeight: "600", 
                  color: "#374151",
                  borderBottom: "2px solid #e5e7eb"
                }}>İşlemler</th>}
              </tr>
            </thead>
            <tbody>
              {bildirimler.map((bildirim) => (
                <tr key={bildirim.id} style={{ 
                  borderBottom: "1px solid rgb(0, 0, 0)",
                  transition: "background-color 0.2s",
                  backgroundColor: selectedIds.includes(bildirim.id) ? "#eff6ff" : "white",
                }}>
                  {userProfile?.is_admin && (
                    <td style={{ padding: "16px 8px", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(bildirim.id)}
                        onChange={() => toggleSelect(bildirim.id)}
                        disabled={bildirim.durum === "cozuldu" || bildirim.durum === "reddedildi"}
                        style={{ 
                          cursor: (bildirim.durum === "cozuldu" || bildirim.durum === "reddedildi") ? "not-allowed" : "pointer", 
                          width: "16px", height: "16px",
                          opacity: (bildirim.durum === "cozuldu" || bildirim.durum === "reddedildi") ? 0.4 : 1
                        }}
                      />
                    </td>
                  )}
                  <td style={{ 
                    padding: "16px 12px", 
                    fontSize: "14px", 
                    color: "#374151"
                  }}>
                    <div>
                      <strong>{format(new Date(bildirim.tarih), "dd MMM yyyy", { locale: trLocale })}</strong>
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>
                      Giriş: {bildirim.giris_saati} | Çıkış: {bildirim.cikis_saati}
                    </div>
                  </td>
                  <td style={{ 
                    padding: "16px 12px", 
                    fontSize: "14px", 
                    color: "#374151"
                  }}>
                    <div>{bildirim.calisan_adi}</div>
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>ID: {bildirim.kullanici_id}</div>
                  </td>
                  <td style={{ 
                    padding: "16px 12px", 
                    fontSize: "14px", 
                    color: "#374151"
                  }}>
                    {getHataTipiLabel(bildirim.hata_tipi)}
                  </td>
                  <td style={{ 
                    padding: "16px 12px", 
                    fontSize: "14px", 
                    color: "#374151",
                    maxWidth: "300px"
                  }}>
                    <div style={{ 
                      whiteSpace: "pre-wrap", 
                      wordBreak: "break-word",
                      maxHeight: "100px",
                      overflow: "auto"
                    }}>
                      {bildirim.aciklama}
                    </div>
                    {bildirim.cozum_notu && (
                      <div style={{ 
                        marginTop: "8px", 
                        padding: "8px", 
                        backgroundColor: "#f0f9ff", 
                        borderRadius: "4px",
                        fontSize: "12px",
                        borderLeft: "3px solid #3b82f6"
                      }}>
                        <strong>Çözüm Notu:</strong> {bildirim.cozum_notu}
                      </div>
                    )}
                  </td>
                  <td style={{ 
                    padding: "16px 12px", 
                    fontSize: "14px", 
                    color: "#374151"
                  }}>
                    <span style={{
                      padding: "4px 8px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "white",
                      backgroundColor: getDurumColor(bildirim.durum)
                    }}>
                      {getDurumLabel(bildirim.durum)}
                    </span>
                  </td>
                  <td style={{ 
                    padding: "16px 12px", 
                    fontSize: "14px", 
                    color: "#374151"
                  }}>
                    {format(new Date(bildirim.bildirim_tarihi), "dd.MM.yyyy HH:mm")}
                  </td>
                  {userProfile?.is_admin && (
                    <td style={{ 
                      padding: "16px 12px", 
                      fontSize: "14px", 
                      color: "#374151"
                    }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {bildirim.durum === "beklemede" && (
                        <>
                          <button
                            onClick={() => updateDurum(bildirim.id, "inceleniyor")}
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
                            İncelemeye Al
                          </button>
                          <button
                            onClick={() => {
                              const cozumNotu = prompt("Çözüm notu ekleyin:");
                              if (cozumNotu !== null) {
                                updateDurum(bildirim.id, "cozuldu", cozumNotu);
                              }
                            }}
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              backgroundColor: "#10b981",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer"
                            }}
                          >
                            Çözüldü
                          </button>
                          <button
                            onClick={() => {
                              const redNotu = prompt("Red nedeni:");
                              if (redNotu !== null) {
                                updateDurum(bildirim.id, "reddedildi", redNotu);
                              }
                            }}
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              backgroundColor: "#ef4444",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer"
                            }}
                          >
                            Reddet
                          </button>
                        </>
                      )}
                      {bildirim.durum === "inceleniyor" && (
                        <>
                          <button
                            onClick={() => {
                              const cozumNotu = prompt("Çözüm notu ekleyin:");
                              if (cozumNotu !== null) {
                                updateDurum(bildirim.id, "cozuldu", cozumNotu);
                              }
                            }}
                            style={{
                              padding: "8px 16px",
                              fontSize: "13px",
                              backgroundColor: "#10b981",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontWeight: "500",
                              transition: "all 0.2s",
                              boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = "#059669";
                              e.target.style.transform = "translateY(-1px)";
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = "#10b981";
                              e.target.style.transform = "translateY(0)";
                            }}
                          >
                            Çözüldü
                          </button>
                          <button
                            onClick={() => {
                              const redNotu = prompt("Red nedeni:");
                              if (redNotu !== null) {
                                updateDurum(bildirim.id, "reddedildi", redNotu);
                              }
                            }}
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
                            Reddet
                          </button>
                        </>
                      )}
                      {(bildirim.durum === "cozuldu" || bildirim.durum === "reddedildi") && (
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>
                          {bildirim.cozum_tarihi && 
                            format(new Date(bildirim.cozum_tarihi), "dd.MM.yyyy HH:mm")
                          }
                        </span>
                                             )}
                     </div>
                   </td>
                   )}
                 </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
