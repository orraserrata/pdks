import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { format } from "date-fns";
import { tr as trLocale } from "date-fns/locale";

function toDateTimeLocalString(value) {
  if (!value) return "";
  const d = new Date(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function toIsoFromLocal(localStr) {
  if (!localStr || localStr.trim() === "") return null;
  // localStr format: YYYY-MM-DDTHH:mm (local time)
  // Convert to Date then to ISO string without timezone shift (store as local time string)
  // To avoid timezone surprises on display, we will send as plain string replacing 'T' with space
  return localStr.replace("T", " ") + ":00";
}

function getDayName(dateValue) {
  try {
    return format(new Date(dateValue), "EEEE", { locale: trLocale });
  } catch (e) {
    return "";
  }
}

export default function AdminPanel() {
  const [session, setSession] = useState(null);
  const today = useMemo(() => new Date(), []);
  const aWeekAgo = useMemo(() => new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), []);

  const [personeller, setPersoneller] = useState([]);
  const [kayitlar, setKayitlar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState({
    kullanici_id: "",
    baslangic: format(aWeekAgo, "yyyy-MM-dd"),
    bitis: format(today, "yyyy-MM-dd"),
  });

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ giris: "", cikis: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => {
      authSub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function loadPersonel() {
      const { data } = await supabase
        .from("personel")
        .select("kullanici_id, isim, soyisim")
        .order("kullanici_id", { ascending: true });
      setPersoneller(data || []);
    }
    if (session) loadPersonel();
  }, [session]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      let query = supabase
        .from("personel_duzenli_with_names")
        .select("*")
        .gte("giris_tarihi", filter.baslangic)
        .lte("giris_tarihi", filter.bitis)
        .order("giris_tarihi", { ascending: true });

      if (filter.kullanici_id) {
        query = query.eq("kullanici_id", Number(filter.kullanici_id));
      }

      let resp = await query;

      if (resp.error) {
        // Fallback to base table + enrich names
        let baseQuery = supabase
          .from("personel_giris_cikis_duzenli")
          .select("id, kullanici_id, giris_tarihi, cikis_tarihi")
          .gte("giris_tarihi", filter.baslangic)
          .lte("giris_tarihi", filter.bitis)
          .order("giris_tarihi", { ascending: true });
        if (filter.kullanici_id) {
          baseQuery = baseQuery.eq("kullanici_id", Number(filter.kullanici_id));
        }
        const base = await baseQuery;
        if (base.error) throw base.error;
        const map = new Map(personeller.map((p) => [p.kullanici_id, p]));
        const enriched = (base.data || []).map((row) => ({
          ...row,
          isim: map.get(row.kullanici_id)?.isim || null,
          soyisim: map.get(row.kullanici_id)?.soyisim || null,
        }));
        setKayitlar(enriched);
      } else {
        setKayitlar(resp.data || []);
      }
    } catch (err) {
      setError(String(err.message || err));
      setKayitlar([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, filter.kullanici_id, filter.baslangic, filter.bitis]);

  if (!session) {
    return (
      <div>
        <h2>Admin Paneli</h2>
        <p>Bu sayfa için giriş yapmalısınız.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Admin Paneli</h2>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
        <label>
          Kullanıcı
          <select
            style={{ marginLeft: 6 }}
            value={filter.kullanici_id}
            onChange={(e) => setFilter((prev) => ({ ...prev, kullanici_id: e.target.value }))}
          >
            <option value="">Tümü</option>
            {personeller.map((p) => (
              <option key={p.kullanici_id} value={p.kullanici_id}>
                {p.kullanici_id} - {p.isim} {p.soyisim}
              </option>
            ))}
          </select>
        </label>
        <label>
          Başlangıç
          <input
            type="date"
            style={{ marginLeft: 6 }}
            value={filter.baslangic}
            onChange={(e) => setFilter((prev) => ({ ...prev, baslangic: e.target.value }))}
          />
        </label>
        <label>
          Bitiş
          <input
            type="date"
            style={{ marginLeft: 6 }}
            value={filter.bitis}
            onChange={(e) => setFilter((prev) => ({ ...prev, bitis: e.target.value }))}
          />
        </label>
        <button onClick={loadData}>Yenile</button>
      </div>

      {error && <div style={{ color: "red", marginBottom: 8 }}>{error}</div>}
      {loading ? (
        <div>Yükleniyor...</div>
      ) : (
        <div>Admin görünümünden saat düzenleme kaldırıldı. Düzenleme "Çalışanlar" sekmesindeki detay ekranından yapılır.</div>
      )}
    </div>
  );
}


