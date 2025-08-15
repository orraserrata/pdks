import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

export default function PersonelYonetimi({ onChanged }) {
  const [form, setForm] = useState({
    kullanici_id: "",
    isim: "",
    soyisim: "",
    ise_giris_tarihi: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);

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
      };

      const { error: insertError } = await supabase
        .from("personel")
        .insert(payload);

      if (insertError) {
        setError(insertError.message || "Kayıt eklenemedi");
      } else {
        setForm({ kullanici_id: "", isim: "", soyisim: "", ise_giris_tarihi: "" });
        if (onChanged) onChanged();
      }
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteByKullaniciId(kullaniciId) {
    if (!window.confirm("Bu personeli silmek istediğinize emin misiniz?")) return;
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
        if (onChanged) onChanged();
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
        <button type="submit" disabled={!isValid || loading}>
          {loading ? "Kaydediliyor..." : "Ekle"}
        </button>
      </form>
      ) : (
        <div style={{ 
          padding: "16px", 
          backgroundColor: "#f3f4f6", 
          borderRadius: "8px", 
          marginBottom: "16px",
          textAlign: "center",
          color: "#6b7280"
        }}>
          Personel eklemek için admin olarak giriş yapın.
        </div>
      )}

      {error && (
        <div style={{ color: "red", marginTop: 8 }}>{error}</div>
      )}

      <PersonelList onDelete={handleDeleteByKullaniciId} session={session} />
    </div>
  );
}

function PersonelList({ onDelete, session }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ isim: "", soyisim: "", ise_giris_tarihi: "" });
  const [saving, setSaving] = useState(false);
  const [lastDeletedPerson, setLastDeletedPerson] = useState(null);
  const [showUndoButton, setShowUndoButton] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data, error: selectError } = await supabase
        .from("personel")
        .select("kullanici_id, isim, soyisim, ise_giris_tarihi")
        .order("kullanici_id", { ascending: true });

      if (selectError) {
        setError(selectError.message || "Veri çekilemedi");
        setItems([]);
      } else {
        setItems(data || []);
      }
    } catch (err) {
      setError(String(err.message || err));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUndoDelete() {
    if (!lastDeletedPerson) return;
    
    setSaving(true);
    setError("");
    try {
      const { error: insertError } = await supabase
        .from("personel")
        .insert(lastDeletedPerson);

      if (insertError) {
        setError(insertError.message || "Geri alma başarısız");
      } else {
        setLastDeletedPerson(null);
        setShowUndoButton(false);
        await load();
      }
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteWithUndo(kullaniciId) {
    if (!window.confirm("Bu personeli silmek istediğinize emin misiniz?")) return;
    
    // Önce personeli bul
    const personToDelete = items.find(p => p.kullanici_id === kullaniciId);
    if (!personToDelete) return;

    setSaving(true);
    setError("");
    try {
      const { error: deleteError } = await supabase
        .from("personel")
        .delete()
        .eq("kullanici_id", kullaniciId);

      if (deleteError) {
        setError(deleteError.message || "Silme işlemi başarısız");
      } else {
        // Silinen personeli sakla
        setLastDeletedPerson(personToDelete);
        setShowUndoButton(true);
        
        // 10 saniye sonra geri al butonunu gizle
        setTimeout(() => {
          setShowUndoButton(false);
          setLastDeletedPerson(null);
        }, 10000);
        
        await load();
      }
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div>Yükleniyor...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;

  return (
    <>
      {showUndoButton && lastDeletedPerson && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 16px",
          backgroundColor: "#fef3c7",
          border: "1px solid #f59e0b",
          borderRadius: "8px",
          marginBottom: "12px",
          animation: "slideIn 0.3s ease-out"
        }}>
          <span style={{ color: "#92400e", fontSize: "14px" }}>
            <strong>{lastDeletedPerson.isim} {lastDeletedPerson.soyisim}</strong> silindi.
          </span>
          <button
            onClick={handleUndoDelete}
            disabled={saving}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              backgroundColor: "#f59e0b",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "500",
              transition: "all 0.2s",
              opacity: saving ? "0.6" : "1"
            }}
            onMouseEnter={(e) => {
              if (!saving) {
                e.target.style.backgroundColor = "#d97706";
              }
            }}
            onMouseLeave={(e) => {
              if (!saving) {
                e.target.style.backgroundColor = "#f59e0b";
              }
            }}
          >
            {saving ? "Geri Alınıyor..." : "Geri Al"}
          </button>
        </div>
      )}
      <div style={{ 
        overflowX: "auto", 
        borderRadius: "8px", 
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
        marginTop: "12px"
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
          }}>Kullanıcı ID</th>
          <th style={{ 
            padding: "16px 12px", 
            textAlign: "left", 
            fontSize: "14px", 
            fontWeight: "600", 
            color: "#374151",
            borderBottom: "2px solid #e5e7eb"
          }}>İsim</th>
          <th style={{ 
            padding: "16px 12px", 
            textAlign: "left", 
            fontSize: "14px", 
            fontWeight: "600", 
            color: "#374151",
            borderBottom: "2px solid #e5e7eb"
          }}>Soyisim</th>
          <th style={{ 
            padding: "16px 12px", 
            textAlign: "left", 
            fontSize: "14px", 
            fontWeight: "600", 
            color: "#374151",
            borderBottom: "2px solid #e5e7eb"
          }}>İşe Giriş Tarihi</th>
          <th style={{ 
            padding: "16px 12px", 
            textAlign: "left", 
            fontSize: "14px", 
            fontWeight: "600", 
            color: "#374151",
            borderBottom: "2px solid #e5e7eb"
          }}>İşlem</th>
        </tr>
      </thead>
      <tbody>
        {items.map((p) => {
          const isEditing = editingId === p.kullanici_id;
          return (
            <tr key={p.kullanici_id} style={{
              borderBottom: "1px solid rgb(0, 0, 0)",
              transition: "background-color 0.2s"
            }}>
              <td style={{ 
                padding: "16px 12px", 
                fontSize: "14px", 
                color: "#374151"
              }}>{p.kullanici_id}</td>
              <td style={{ 
                padding: "16px 12px", 
                fontSize: "14px", 
                color: "#374151"
              }}>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.isim}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, isim: e.target.value }))}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontSize: "14px",
                      width: "100%"
                    }}
                  />
                ) : (
                  p.isim
                )}
              </td>
              <td style={{ 
                padding: "16px 12px", 
                fontSize: "14px", 
                color: "#374151"
              }}>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.soyisim}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, soyisim: e.target.value }))}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontSize: "14px",
                      width: "100%"
                    }}
                  />
                ) : (
                  p.soyisim
                )}
              </td>
              <td style={{ 
                padding: "16px 12px", 
                fontSize: "14px", 
                color: "#374151"
              }}>
                {isEditing ? (
                  <input
                    type="date"
                    value={editForm.ise_giris_tarihi}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, ise_giris_tarihi: e.target.value }))}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontSize: "14px"
                    }}
                  />
                ) : (
                  p.ise_giris_tarihi
                )}
              </td>
              <td style={{ 
                padding: "16px 12px", 
                fontSize: "14px", 
                color: "#374151"
              }}>
                <div style={{ display: "flex", gap: "8px" }}>
                {isEditing ? (
                  <>
                    <button
                      disabled={saving}
                      onClick={async () => {
                        setSaving(true);
                        setError("");
                        try {
                          const { error: updateError } = await supabase
                            .from("personel")
                            .update({
                              isim: editForm.isim.trim(),
                              soyisim: editForm.soyisim.trim(),
                              ise_giris_tarihi: editForm.ise_giris_tarihi,
                            })
                            .eq("kullanici_id", p.kullanici_id);

                          if (updateError) {
                            setError(updateError.message || "Güncelleme başarısız");
                          } else {
                            setEditingId(null);
                            await load();
                          }
                        } catch (err) {
                          setError(String(err.message || err));
                        } finally {
                          setSaving(false);
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
                        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                        opacity: saving ? "0.6" : "1"
                      }}
                      onMouseEnter={(e) => {
                        if (!saving) {
                          e.target.style.backgroundColor = "#059669";
                          e.target.style.transform = "translateY(-1px)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!saving) {
                          e.target.style.backgroundColor = "#10b981";
                          e.target.style.transform = "translateY(0)";
                        }
                      }}
                    >
                      Kaydet
                    </button>
                    <button 
                      disabled={saving} 
                      onClick={() => setEditingId(null)}
                      style={{
                        padding: "8px 16px",
                        fontSize: "13px",
                        backgroundColor: "#6b7280",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: "500",
                        transition: "all 0.2s",
                        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                        opacity: saving ? "0.6" : "1"
                      }}
                      onMouseEnter={(e) => {
                        if (!saving) {
                          e.target.style.backgroundColor = "#4b5563";
                          e.target.style.transform = "translateY(-1px)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!saving) {
                          e.target.style.backgroundColor = "#6b7280";
                          e.target.style.transform = "translateY(0)";
                        }
                      }}
                    >
                      İptal
                    </button>
                  </>
                ) : (
                  <>
                    {session && (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(p.kullanici_id);
                            setEditForm({
                              isim: p.isim || "",
                              soyisim: p.soyisim || "",
                              ise_giris_tarihi: p.ise_giris_tarihi || "",
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
                  </>
                )}
              </div>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
  </div>
    </>
  );
}


