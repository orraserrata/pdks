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

  useEffect(() => {
    loadBildirimler();
  }, [filter]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadBildirimler() {
    setLoading(true);
    setError("");
    try {
      let query = supabase
        .from("hata_bildirimleri")
        .select("*")
        .order("bildirim_tarihi", { ascending: false });

      if (filter !== "tumu") {
        query = query.eq("durum", filter);
      }

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
        alert(updateError.message || "Durum güncellenemedi");
      } else {
        // Listeyi yenile
        loadBildirimler();
      }
    } catch (err) {
      alert(String(err.message || err));
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

  return (
    <div>
      <h2>Hata Bildirimleri</h2>
      
      <div style={{ marginBottom: "16px" }}>
        <label style={{ marginRight: "12px", fontWeight: "bold" }}>Filtre:</label>
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
                {session && <th style={{ 
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
                  transition: "background-color 0.2s"
                }}>
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
                  {session && (
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
