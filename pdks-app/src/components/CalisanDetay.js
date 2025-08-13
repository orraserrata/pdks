// components/CalisanDetay.js

import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { format, eachDayOfInterval } from "date-fns";
import Modal from "./Modal";

function CalisanDetay({ calisan }) {
  const [girisCikis, setGirisCikis] = useState([]);
  const [baslangic, setBaslangic] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bitis, setBitis] = useState(format(new Date(), "yyyy-MM-dd"));
  const [session, setSession] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [editing, setEditing] = useState(null); // { id, giris_tarihi, cikis_tarihi }
  const [editValues, setEditValues] = useState({ giris: "", cikis: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchGirisCikis() {
      if (!calisan) return;
      const { data, error } = await supabase
        .from("personel_giris_cikis_duzenli")
        .select("*")
        .eq("kullanici_id", calisan.kullanici_id ?? calisan.id)
        .gte("giris_tarihi", baslangic)
        .lte("giris_tarihi", bitis)
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

  // Günlük kayıtları ve süreyi hesapla
  const gunlerWithData = gunler
    .map((gun) => {
      const dateStr = format(gun, "yyyy-MM-dd");
      const kayitlar = girisCikis.filter((g) =>
        g.giris_tarihi.startsWith(dateStr)
      );

      if (kayitlar.length === 0) {
        return [{ tarih: dateStr, giris: "-", cikis: "Devamsız", sure: 0 }];
      }

      return kayitlar.map((k) => {
        const giris = new Date(k.giris_tarihi);
        const cikis = k.cikis_tarihi ? new Date(k.cikis_tarihi) : null;
        const sure = cikis ? (cikis - giris) / (1000 * 60 * 60) : 0; // saat cinsinden
        return {
          tarih: dateStr,
          giris: format(giris, "HH:mm"),
          cikis: cikis ? format(cikis, "HH:mm") : "-",
          sure,
        };
      });
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
          : `Kullanıcı ${calisan.kullanici_id ?? calisan.id}`} Devamsızlık
      </h2>

      <label>
        Başlangıç:
        <input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} />
      </label>
      <label style={{ marginLeft: "10px" }}>
        Bitiş:
        <input type="date" value={bitis} onChange={(e) => setBitis(e.target.value)} />
      </label>

      <table border="1" style={{ marginTop: "10px", borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Giriş</th>
            <th>Çıkış</th>
            <th>Süre (saat)</th>
            {session && <th>İşlem</th>}
          </tr>
        </thead>
        <tbody>
          {gunlerWithData.map((g, i) => {
            const row = girisCikis.find((r) => r.giris_tarihi.startsWith(g.tarih));
            return (
              <tr key={i}>
                <td>{g.tarih}</td>
                <td>{g.giris}</td>
                <td>{g.cikis}</td>
                <td>{g.sure.toFixed(2)}</td>
                {session && (
                  <td>
                    {row && (
                      <button onClick={() => {
                        setEditing(row);
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
                      }}>Düzenle</button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan="3" style={{ textAlign: "right" }}>Toplam Süre:</td>
            <td>{toplamSure} saat</td>
            {session && <td />}
          </tr>
        </tfoot>
      </table>

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
          <button
            onClick={async () => {
              // admin kontrolü RLS tarafından sağlanacak; burada sadece update deniyoruz
              const toIso = (s) => (s ? s.replace('T', ' ') + ':00' : null);
              if (!editing) return;
              const { error } = await supabase
                .from('personel_giris_cikis_duzenli')
                .update({ giris_tarihi: toIso(editValues.giris), cikis_tarihi: toIso(editValues.cikis) })
                .eq('id', editing.id);
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
        </div>
      </Modal>
    </div>
  );
}

export default CalisanDetay;
