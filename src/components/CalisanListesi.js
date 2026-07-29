// components/CalisanListesi.js
import React, { useState, useMemo, useEffect } from "react";
import { supabase } from "../supabaseClient";
import LoadingSpinner from "./LoadingSpinner";
import { format, startOfMonth, endOfMonth, addDays } from "date-fns";

const DAY_START_HOUR = 5;

function getDisplayDate(row) {
  if (row.workday_date) return row.workday_date;
  const girisDt = new Date(row.giris_tarihi);
  return format(new Date(girisDt.getTime() - DAY_START_HOUR * 60 * 60 * 1000), "yyyy-MM-dd");
}

function countIncompleteDays(rows, monthStartStr, monthEndStr, todayStr) {
  const byDay = {};
  for (const row of rows) {
    const displayDate = getDisplayDate(row);
    if (displayDate < monthStartStr || displayDate > monthEndStr) continue;
    if (displayDate === todayStr) continue;
    if (!byDay[displayDate]) byDay[displayDate] = [];
    byDay[displayDate].push(row);
  }

  let count = 0;
  for (const dayRows of Object.values(byDay)) {
    const incomplete =
      dayRows.length === 1 &&
      !dayRows[0].cikis_tarihi &&
      dayRows[0].admin_locked !== true;
    if (incomplete) count += 1;
  }
  return count;
}

export default function CalisanListesi({ personeller, onCalisanSelect, seciliCalisan, session }) {
  const [filter, setFilter] = useState("active"); // "all", "active", "inactive"
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [incompleteCounts, setIncompleteCounts] = useState({});
  
  // Filtreleme ve sıralama
  const filteredAndSorted = useMemo(() => {
    let filtered = personeller || [];
    
    // Filtreleme uygula
    if (filter === "active") {
      filtered = filtered.filter(p => p.aktif !== false); // aktif olmayanlar false ise filtrele
    } else if (filter === "inactive") {
      filtered = filtered.filter(p => p.aktif === false); // sadece pasif olanlar
    }
    // "all" için filtre uygulanmaz
    
    // Sıralama
    return filtered.slice().sort((a, b) => {
      const aName = (a.isim || `ID ${a.kullanici_id}`) + " " + (a.soyisim || "");
      const bName = (b.isim || `ID ${b.kullanici_id}`) + " " + (b.soyisim || "");
      return aName.localeCompare(bName, 'tr', { sensitivity: 'base' });
    });
  }, [personeller, filter]);

  // Mevcut ay: eksik çıkışlı tek kayıt günlerini say
  useEffect(() => {
    async function loadIncompleteCounts() {
      if (!personeller || personeller.length === 0) {
        setIncompleteCounts({});
        return;
      }

      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const monthStartStr = format(monthStart, "yyyy-MM-dd");
      const monthEndStr = format(monthEnd, "yyyy-MM-dd");
      const todayStr = format(now, "yyyy-MM-dd");
      const fetchStart = format(addDays(monthStart, -1), "yyyy-MM-dd");
      const fetchEnd = format(addDays(monthEnd, 2), "yyyy-MM-dd");
      const ids = personeller.map((p) => p.kullanici_id).filter((id) => id != null);

      if (ids.length === 0) {
        setIncompleteCounts({});
        return;
      }

      const { data, error } = await supabase
        .from("personel_giris_cikis_duzenli")
        .select("kullanici_id, giris_tarihi, cikis_tarihi, workday_date, admin_locked")
        .in("kullanici_id", ids)
        .gte("giris_tarihi", fetchStart)
        .lt("giris_tarihi", fetchEnd);

      if (error) {
        console.error("Eksik kayıt sayımı hatası:", error);
        setIncompleteCounts({});
        return;
      }

      const byUser = {};
      for (const row of data || []) {
        if (!byUser[row.kullanici_id]) byUser[row.kullanici_id] = [];
        byUser[row.kullanici_id].push(row);
      }

      const counts = {};
      for (const id of ids) {
        const n = countIncompleteDays(byUser[id] || [], monthStartStr, monthEndStr, todayStr);
        if (n > 0) counts[id] = n;
      }
      setIncompleteCounts(counts);
    }

    loadIncompleteCounts();
  }, [personeller]);

  // Kullanıcı profilini yükle
  useEffect(() => {
    async function loadUserProfile() {
      if (!session?.user) {
        console.log("Session yok");
        setUserProfile(null);
        setProfileLoading(false);
        return;
      }
      
      console.log("Session var:", session.user.email);
      setProfileLoading(true);
      setProfileError("");
      
      try {
        const metaKullaniciId = session?.user?.user_metadata?.kullanici_id;
        const email = session?.user?.email || null;

        console.log("Email:", email);
        console.log("Meta kullanici_id:", metaKullaniciId);

        // Önce email ile profil arama yap
        let query = supabase.from("kullanici_profilleri").select("*");
        if (email) {
          query = query.eq("email", email);
          console.log("Email ile arama yapılıyor:", email);
        }

        let { data, error } = await query.maybeSingle();
        console.log("Sorgu sonucu:", { data, error });

        if (error) {
          console.error("Profil yükleme hatası:", error);
          setProfileError(error.message || "Profil alınamadı");
          setUserProfile(null);
        } else if (data) {
          console.log("Profil bulundu:", data);
          setUserProfile(data);
                 } else {
           // Profil bulunamadı - admin olup olmadığını kontrol et
           console.log("Profil bulunamadı, admin kontrolü yapılıyor");
           
           // Admin kontrolü için admin_users tablosundan kontrol et
           // admin_users tablosunda email yok, user_id var
           // Önce auth.users tablosundan user_id'yi bul
           const { data: authUser } = await supabase.auth.getUser();
           
           if (authUser?.user?.id) {
             const adminCheck = await supabase
               .from("admin_users")
               .select("user_id")
               .eq("user_id", authUser.user.id)
               .maybeSingle();
             
             console.log("Admin kontrolü sonucu:", adminCheck);
             
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
               console.log("Geçici admin profili oluşturuldu:", tempAdminProfile);
               setUserProfile(tempAdminProfile);
             } else {
               // Normal kullanıcı ama profil yok - hata ver
               console.log("Normal kullanıcı için profil bulunamadı");
               setProfileError("Bu hesap için profil kaydı bulunamadı. Lütfen yöneticinizle iletişime geçin.");
               setUserProfile(null);
             }
                       } else {
              console.log("Auth user bulunamadı");
              setProfileError("Kullanıcı kimliği bulunamadı. Lütfen yöneticinizle iletişime geçin.");
              setUserProfile(null);
            }
         }
      } catch (err) {
        console.error("Profil yükleme exception:", err);
        setProfileError(String(err.message || err));
        setUserProfile(null);
      } finally {
        setProfileLoading(false);
      }
    }

    loadUserProfile();
  }, [session]);

  return (
    <div>
      <h2>Çalışan Listesi</h2>
      
      {/* Giriş kontrolü */}
      {!session ? (
        <div style={{
          padding: "12px",
          backgroundColor: "#fef3c7",
          border: "1px solid #f59e0b",
          borderRadius: "6px",
          marginBottom: "12px"
        }}>
          <div style={{ fontSize: "14px", color: "#92400e", fontWeight: "500", marginBottom: "4px" }}>
            Giriş Gerekli
          </div>
          <div style={{ fontSize: "13px", color: "#92400e" }}>
            Çalışan saatlerini görüntülemek için lütfen önce hesap oluşturun veya giriş yapın.
          </div>
        </div>
      ) : profileLoading ? (
        <LoadingSpinner />
      ) : !userProfile ? (
        <div style={{
          padding: "12px",
          backgroundColor: "#fee2e2",
          border: "1px solid #ef4444",
          borderRadius: "6px",
          marginBottom: "12px"
        }}>
          <div style={{ fontSize: "14px", color: "#991b1b", fontWeight: "600", marginBottom: "4px" }}>
            Profil Bulunamadı
          </div>
          <div style={{ fontSize: "13px", color: "#991b1b" }}>
            Bu hesap için profil kaydı bulunamadı. Lütfen önce "Hesap Oluştur" bölümünden kayıt olun veya yöneticinizle iletişime geçin.
          </div>
          {profileError && (
            <div style={{ fontSize: "12px", color: "#991b1b", marginTop: "6px" }}>
              Hata: {profileError}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Admin Filtreleme Butonları */}
          {userProfile.is_admin && (
            <div style={{
              display: "flex",
              gap: "8px",
              marginBottom: "12px",
              alignItems: "center",
              flexWrap: "wrap"
            }}>
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
          )}

          {/* Normal kullanıcılar için direkt kendi saatlerini göster */}
          {!userProfile.is_admin && (
            <div style={{ 
              marginTop: "12px",
              padding: "12px",
              backgroundColor: "#f9fafb",
              borderRadius: "8px",
              border: "1px solid #e5e7eb"
            }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#374151" }}>
                Kendi Saatleriniz
              </h3>
              {(() => {
                const kendiPersonel = personeller.find(p => p.kullanici_id === userProfile.kullanici_id);
                if (kendiPersonel) {
                  return (
                    <button
                      type="button"
                      className={`personRow${seciliCalisan?.kullanici_id === kendiPersonel.kullanici_id ? " personRow--selected" : ""}`}
                      onClick={() => onCalisanSelect(kendiPersonel)}
                      style={{
                        position: "relative",
                        opacity: kendiPersonel.aktif === false ? 0.7 : 1
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: "8px" }}>
                        <span>{kendiPersonel.isim || `ID: ${kendiPersonel.kullanici_id}`} {kendiPersonel.soyisim || ""}</span>
                        <div className="personRow-badges">
                          {(incompleteCounts[kendiPersonel.kullanici_id] || 0) > 0 && (
                            <span
                              className="person-alert-badge"
                              title={`Bu ay ${incompleteCounts[kendiPersonel.kullanici_id]} günde eksik çıkış kaydı var`}
                            >
                              {incompleteCounts[kendiPersonel.kullanici_id]}
                            </span>
                          )}
                          {kendiPersonel.aktif === false && (
                            <span className="person-passive-badge">Pasif</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                } else {
                  return <div>Kendi personel kaydınız bulunamadı.</div>;
                }
              })()}
            </div>
          )}

          {/* Admin için personel listesi - Sadece admin girişi yapılmışsa göster */}
          {userProfile.is_admin && (
            <div style={{ 
              marginTop: "12px",
              padding: "12px",
              backgroundColor: "#f9fafb",
              borderRadius: "8px",
              border: "1px solid #e5e7eb"
            }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#374151" }}>
                Personeller
              </h3>
              {(!personeller || personeller.length === 0) ? (
                <div>Personel bulunamadı. Lütfen önce Personel Yönetimi sekmesinden ekleyin.</div>
              ) : filteredAndSorted.length === 0 ? (
                <div>Seçilen filtrelere uygun personel bulunamadı.</div>
              ) : (
                <div className="personList">
                  {filteredAndSorted.map((p) => (
                    <button
                      key={p.kullanici_id}
                      type="button"
                      className={`personRow${seciliCalisan?.kullanici_id === p.kullanici_id ? " personRow--selected" : ""}`}
                      onClick={() => onCalisanSelect(p)}
                      style={{
                        position: "relative",
                        opacity: p.aktif === false ? 0.7 : 1
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: "8px" }}>
                        <span>{p.isim || `ID: ${p.kullanici_id}`} {p.soyisim || ""}</span>
                        <div className="personRow-badges">
                          {(incompleteCounts[p.kullanici_id] || 0) > 0 && (
                            <span
                              className="person-alert-badge"
                              title={`Bu ay ${incompleteCounts[p.kullanici_id]} günde eksik çıkış kaydı var`}
                            >
                              {incompleteCounts[p.kullanici_id]}
                            </span>
                          )}
                          {p.aktif === false && (
                            <span className="person-passive-badge">Pasif</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}