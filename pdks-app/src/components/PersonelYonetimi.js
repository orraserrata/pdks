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

  const isValid = useMemo(() => {
    return (
      String(form.kullanici_id).trim() !== "" &&
      form.isim.trim() !== "" &&
      form.soyisim.trim() !== "" &&
      form.ise_giris_tarihi.trim() !== ""
    );
  }, [form]);

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

      {error && (
        <div style={{ color: "red", marginTop: 8 }}>{error}</div>
      )}

      <PersonelList onDelete={handleDeleteByKullaniciId} />
    </div>
  );
}

function PersonelList({ onDelete }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ isim: "", soyisim: "", ise_giris_tarihi: "" });
  const [saving, setSaving] = useState(false);

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

  if (loading) return <div>Yükleniyor...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;

  return (
    <table border="1" style={{ marginTop: 12, borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th>Kullanıcı ID</th>
          <th>İsim</th>
          <th>Soyisim</th>
          <th>İşe Giriş</th>
          <th>İşlem</th>
        </tr>
      </thead>
      <tbody>
        {items.map((p) => {
          const isEditing = editingId === p.kullanici_id;
          return (
            <tr key={p.kullanici_id}>
              <td>{p.kullanici_id}</td>
              <td>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.isim}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, isim: e.target.value }))}
                  />
                ) : (
                  p.isim
                )}
              </td>
              <td>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.soyisim}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, soyisim: e.target.value }))}
                  />
                ) : (
                  p.soyisim
                )}
              </td>
              <td>
                {isEditing ? (
                  <input
                    type="date"
                    value={editForm.ise_giris_tarihi}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, ise_giris_tarihi: e.target.value }))}
                  />
                ) : (
                  p.ise_giris_tarihi
                )}
              </td>
              <td style={{ display: "flex", gap: 6 }}>
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
                    >
                      Kaydet
                    </button>
                    <button disabled={saving} onClick={() => setEditingId(null)}>İptal</button>
                  </>
                ) : (
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
                    >
                      Düzenle
                    </button>
                    <button onClick={() => onDelete(p.kullanici_id)}>Sil</button>
                  </>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}


