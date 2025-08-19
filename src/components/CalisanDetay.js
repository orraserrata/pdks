// components/CalisanDetay.js

import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { format, eachDayOfInterval, addDays } from "date-fns";
import { tr as trLocale } from "date-fns/locale";
import Modal from "./Modal";
import HataBildirimi from "./HataBildirimi";

function CalisanDetay({ calisan }) {
  const [girisCikis, setGirisCikis] = useState([]);
  const [baslangic, setBaslangic] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bitis, setBitis] = useState(format(new Date(), "yyyy-MM-dd"));
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [editing, setEditing] = useState(null); // { id?, giris_tarihi?, cikis_tarihi?, isNew? }
  const [editValues, setEditValues] = useState({ giris: "", cikis: "" });
  const [lockChecked, setLockChecked] = useState(false);
  const [showHataBildirimi, setShowHataBildirimi] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const dayStartHour = 5; // iş günü başlangıcı

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

  useEffect(() => {
    async function fetchGirisCikis() {
      if (!calisan) return;
      const endExclusive = format(addDays(new Date(bitis), 1), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("personel_giris_cikis_duzenli")
        .select("*")
        .eq("kullanici_id", calisan.kullanici_id ?? calisan.id)
        .gte("giris_tarihi", baslangic)
        .lt("giris_tarihi", endExclusive)
        .order("giris_tarihi", { ascending: true });

      if (error) {
        console.error("Hata:", error);
        setGirisCikis([]);
      } else {
        setGirisCikis(data || []);
      }
    }
    fetchGirisCikis();
  }, [calisan, baslangic, bitis]);

  const gunler = eachDayOfInterval({
    start: new Date(baslangic),
    end: new Date(bitis),
  });

  // Kayıtları iş günü kaydırmalı gösterime göre grupla
  const recordsForDisplay = girisCikis.map((k) => {
    const girisDt = new Date(k.giris_tarihi);
    const cikisDt = k.cikis_tarihi ? new Date(k.cikis_tarihi) : null;
    const sure = cikisDt ? (cikisDt - girisDt) / (1000 * 60 * 60) : 0;
    const displayDate = k.workday_date
      ? k.workday_date
      : format(new Date(girisDt.getTime() - dayStartHour * 60 * 60 * 1000), "yyyy-MM-dd");
    return { ...k, girisDt, cikisDt, displayDate, sure };
  });

  // Günlük satırları üret (bir günde birden çok aralık olabilir)
  const gunlerWithData = gunler
    .map((gun) => {
      const dateStr = format(gun, "yyyy-MM-dd");
      const recs = recordsForDisplay
        .filter((r) => r.displayDate === dateStr)
        .sort((a, b) => a.girisDt - b.girisDt);
      if (recs.length === 0) {
        return [{ tarih: dateStr, gun: format(new Date(dateStr), "EEEE", { locale: trLocale }), giris: "-", cikis: "Devamsız", sure: 0, _row: null }];
      }
      return recs.map((r) => ({
        tarih: dateStr,
        gun: format(new Date(dateStr), "EEEE", { locale: trLocale }),
        giris: format(r.girisDt, "HH:mm"),
        cikis: r.cikisDt ? format(r.cikisDt, "HH:mm") : "-",
        sure: r.sure,
        _row: r,
      }));
    })
    .flat();

  // Toplam süre
  const toplamSure = gunlerWithData
    .reduce((sum, g) => sum + g.sure, 0)
    .toFixed(2);

  return (
    <div>
      <h2>
        {(calisan.isim || calisan.soyisim)
          ? `${calisan.isim || ""} ${calisan.soyisim || ""}`.trim()
          : `Kullanıcı ${calisan.kullanici_id ?? calisan.id}`} Çalışma Saatleri
      </h2>

      <div style={{ 
        display: "flex", 
        gap: "16px", 
        marginBottom: "20px", 
        alignItems: "center",
        padding: "16px",
        backgroundColor: "#f8fafc",
        borderRadius: "8px",
        border: "1px solid #e2e8f0"
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>Başlangıç:</label>
          <input 
            type="date" 
            value={baslangic} 
            onChange={(e) => setBaslangic(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px",
              backgroundColor: "white"
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>Bitiş:</label>
          <input 
            type="date" 
            value={bitis} 
            onChange={(e) => setBitis(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "14px",
              backgroundColor: "white"
            }}
          />
        </div>
      </div>

      <div style={{ 
        overflowX: "auto", 
        borderRadius: "8px", 
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
      }}>
        <table style={{ 
          width: "100%", 
          borderCollapse: "collapse",
          backgroundColor: "white"
        }}>
        <thead>
          <tr style={{ backgroundColor: "#f9fafb" }}>
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
            }}>Gün</th>
            <th style={{ 
              padding: "16px 12px", 
              textAlign: "left", 
              fontSize: "14px", 
              fontWeight: "600", 
              color: "#374151",
              borderBottom: "2px solid #e5e7eb"
            }}>Giriş</th>
            <th style={{ 
              padding: "16px 12px", 
              textAlign: "left", 
              fontSize: "14px", 
              fontWeight: "600", 
              color: "#374151",
              borderBottom: "2px solid #e5e7eb"
            }}>Çıkış</th>
            <th style={{ 
              padding: "16px 12px", 
              textAlign: "left", 
              fontSize: "14px", 
              fontWeight: "600", 
              color: "#374151",
              borderBottom: "2px solid #e5e7eb"
            }}>Süre (saat)</th>
            <th style={{ 
              padding: "16px 12px", 
              textAlign: "left", 
              fontSize: "14px", 
              fontWeight: "600", 
              color: "#374151",
              borderBottom: "2px solid #e5e7eb"
            }}>Hata Bildir</th>
            {session && userProfile && userProfile.is_admin && <th style={{ 
              padding: "16px 12px", 
              textAlign: "left", 
              fontSize: "14px", 
              fontWeight: "600", 
              color: "#374151",
              borderBottom: "2px solid #e5e7eb"
            }}>İşlem</th>}
          </tr>
        </thead>
        <tbody>
          {gunlerWithData.map((g, i) => {
            const row = g._row || null;
            const isManualEdit = row && row.admin_locked;
            const isAbsent = !row;
            return (
              <tr key={i} className={
                isAbsent ? "absent-row" : 
                isManualEdit ? "manual-edit-row" : ""
              } style={{
                borderBottom: "1px solid rgb(0, 0, 0)",
                transition: "background-color 0.2s",
                ...(isAbsent ? { backgroundColor: '#fef3c7' } : 
                    isManualEdit ? { backgroundColor: '#fee2e2' } : 
                    { backgroundColor: 'white' })
              }}>
                <td style={{ 
                  padding: "16px 12px", 
                  fontSize: "14px", 
                  color: "#374151",
                  fontWeight: isAbsent ? "600" : "normal"
                }}>{g.tarih}</td>
                <td style={{ 
                  padding: "16px 12px", 
                  fontSize: "14px", 
                  color: "#374151",
                  fontWeight: isAbsent ? "600" : "normal"
                }}>{g.gun}</td>
                <td style={{ 
                  padding: "16px 12px", 
                  fontSize: "14px", 
                  color: isAbsent ? "#ef4444" : "#374151",
                  fontWeight: isAbsent ? "600" : "normal"
                }}>{row ? g.giris : '-'}</td>
                <td style={{ 
                  padding: "16px 12px", 
                  fontSize: "14px", 
                  color: isAbsent ? "#ef4444" : "#374151",
                  fontWeight: isAbsent ? "600" : "normal"
                }}>{row ? g.cikis : 'Devamsız'}</td>
                <td style={{ 
                  padding: "16px 12px", 
                  fontSize: "14px", 
                  color: "#374151",
                  fontWeight: "600"
                }}>{g.sure.toFixed(2)}</td>
                <td style={{ padding: "16px 12px" }}>
                  <button
                    onClick={() => {
                      setSelectedRecord({
                        calisan: calisan,
                        tarih: g.tarih,
                        giris: row ? g.giris : '-',
                        cikis: row ? g.cikis : 'Devamsız'
                      });
                      setShowHataBildirimi(true);
                    }}
                    style={{
                      padding: "8px 16px",
                      fontSize: "13px",
                      backgroundColor: "#dc2626",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "500",
                      transition: "all 0.2s",
                      boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "#b91c1c";
                      e.target.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = "#dc2626";
                      e.target.style.transform = "translateY(0)";
                    }}
                  >
                    Hata Bildir
                  </button>
                </td>
                {session && userProfile && userProfile.is_admin && (
                  <td style={{ padding: "16px 12px" }}>
                    {row ? (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button 
                          onClick={() => {
                          setEditing(row);
                          setLockChecked(row.admin_locked !== false);
                          const toLocal = (v) => {
                            if (!v) return "";
                            const d = new Date(v);
                            const yyyy = d.getFullYear();
                            const mm = String(d.getMonth() + 1).padStart(2, "0");
                            const dd = String(d.getDate()).padStart(2, "0");
                            const hh = String(d.getHours()).padStart(2, "0");
                            const min = String(d.getMinutes()).padStart(2, "0");
                            return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
                          };
                          setEditValues({
                            giris: toLocal(row.giris_tarihi),
                            cikis: toLocal(row.cikis_tarihi),
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
                          onClick={async () => {
                            if (!window.confirm('Bu kaydı silmek istiyor musunuz?')) return;
                            const { error } = await supabase
                              .from('personel_giris_cikis_duzenli')
                              .delete()
                              .eq('id', row.id);
                            if (!error) {
                              const { data } = await supabase
                                .from('personel_giris_cikis_duzenli')
                                .select('*')
                                .eq('kullanici_id', calisan.kullanici_id ?? calisan.id)
                                .gte('giris_tarihi', baslangic)
                                .lte('giris_tarihi', bitis)
                                .order('giris_tarihi', { ascending: true });
                              setGirisCikis(data || []);
                            } else {
                              alert(error.message || 'Silme başarısız');
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
                          Sil
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          // Devamsız gün için yeni kayıt ekle
                          setEditing({ isNew: true, kullanici_id: calisan.kullanici_id ?? calisan.id, displayDate: g.tarih });
                          setLockChecked(false);
                          setEditValues({ giris: `${g.tarih}T08:00`, cikis: `${g.tarih}T17:00` });
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
                        Ekle
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ backgroundColor: "#f9fafb", borderTop: "2px solid #e5e7eb" }}>
            <td colSpan="4" style={{ 
              textAlign: "right", 
              padding: "16px 12px",
              fontSize: "14px",
              fontWeight: "600",
              color: "#374151"
            }}>Toplam Süre:</td>
            <td style={{ 
              padding: "16px 12px",
              fontSize: "14px",
              fontWeight: "600",
              color: "#374151"
            }}>{toplamSure} saat</td>
            <td></td>
            {session && <td />}
          </tr>
        </tfoot>
      </table>
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Saatleri Düzenle"
      >
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label>
            Giriş
            <input
              type="datetime-local"
              value={editValues.giris}
              onChange={(e) => setEditValues((p) => ({ ...p, giris: e.target.value }))}
              style={{ marginLeft: 6 }}
            />
          </label>
          <label>
            Çıkış
            <input
              type="datetime-local"
              value={editValues.cikis}
              onChange={(e) => setEditValues((p) => ({ ...p, cikis: e.target.value }))}
              style={{ marginLeft: 6 }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={lockChecked} onChange={(e) => setLockChecked(e.target.checked)} />
            Günü kilitle (cihaz verisi üzerine yazmasın)
          </label>
          <button
            onClick={async () => {
              // admin kontrolü RLS tarafından sağlanacak; burada sadece update deniyoruz
              const toIso = (s) => (s ? s.replace('T', ' ') + ':00' : null);
              const toWorkday = (s) => {
                if (!s) return null;
                const d = new Date(s);
                const shifted = new Date(d.getTime() - dayStartHour * 60 * 60 * 1000);
                return format(shifted, "yyyy-MM-dd");
              };
              if (!editing) return;
              let error;
              if (editing.isNew) {
                const insertPayload = {
                  kullanici_id: editing.kullanici_id,
                  giris_tarihi: toIso(editValues.giris),
                  cikis_tarihi: toIso(editValues.cikis),
                  admin_locked: lockChecked,
                  workday_date: toWorkday(editValues.giris) || null,
                };
                const resp = await supabase
                  .from('personel_giris_cikis_duzenli')
                  .insert(insertPayload);
                error = resp.error;
              } else {
                const resp = await supabase
                  .from('personel_giris_cikis_duzenli')
                  .update({
                    giris_tarihi: toIso(editValues.giris),
                    cikis_tarihi: toIso(editValues.cikis),
                    admin_locked: lockChecked,
                    workday_date: toWorkday(editValues.giris) || null,
                  })
                  .eq('id', editing.id);
                error = resp.error;
              }
              if (!error) {
                setEditing(null);
                // yenile
                const { data } = await supabase
                  .from('personel_giris_cikis_duzenli')
                  .select('*')
                  .eq('kullanici_id', calisan.kullanici_id ?? calisan.id)
                  .gte('giris_tarihi', baslangic)
                  .lte('giris_tarihi', bitis)
                  .order('giris_tarihi', { ascending: true });
                setGirisCikis(data || []);
              } else {
                alert(error.message || 'Güncelleme başarısız');
              }
            }}
          >Kaydet</button>
          <button
            onClick={async () => {
              if (!editing) return;
              if (!window.confirm('Bu gün için workday_date kolonunu temizlemek istiyor musunuz?')) return;
              const { error } = await supabase
                .from('personel_giris_cikis_duzenli')
                .update({ workday_date: null })
                .eq('id', editing.id);
              if (!error) {
                setEditing(null);
                const { data } = await supabase
                  .from('personel_giris_cikis_duzenli')
                  .select('*')
                  .eq('kullanici_id', calisan.kullanici_id ?? calisan.id)
                  .gte('giris_tarihi', baslangic)
                  .lte('giris_tarihi', bitis)
                  .order('giris_tarihi', { ascending: true });
                setGirisCikis(data || []);
              } else {
                alert(error.message || 'Temizleme başarısız');
              }
            }}
          >Gün anahtarını temizle</button>
        </div>
      </Modal>

      <HataBildirimi
        open={showHataBildirimi}
        onClose={() => setShowHataBildirimi(false)}
        calisan={selectedRecord?.calisan}
        tarih={selectedRecord?.tarih}
        giris={selectedRecord?.giris}
        cikis={selectedRecord?.cikis}
      />
    </div>
  );
}

export default CalisanDetay;
