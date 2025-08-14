// components/CalisanDetay.js

import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { format, eachDayOfInterval, addDays } from "date-fns";
import { tr as trLocale } from "date-fns/locale";
import Modal from "./Modal";

function CalisanDetay({ calisan }) {
  const [girisCikis, setGirisCikis] = useState([]);
  const [baslangic, setBaslangic] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bitis, setBitis] = useState(format(new Date(), "yyyy-MM-dd"));
  const [session, setSession] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [editing, setEditing] = useState(null); // { id?, giris_tarihi?, cikis_tarihi?, isNew? }
  const [editValues, setEditValues] = useState({ giris: "", cikis: "" });
  const [lockChecked, setLockChecked] = useState(false);
  const dayStartHour = 5; // iş günü başlangıcı

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

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
            <th>Gün</th>
            <th>Giriş</th>
            <th>Çıkış</th>
            <th>Süre (saat)</th>
            {session && <th>İşlem</th>}
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
              } style={
                isAbsent ? { backgroundColor: '#fff8c5' } : 
                isManualEdit ? { backgroundColor: '#ff0000a8' } : {}
              }>
                <td>{g.tarih}</td>
                <td>{g.gun}</td>
                <td>{row ? g.giris : '-'}</td>
                <td>{row ? g.cikis : 'Devamsız'}</td>
                <td>{g.sure.toFixed(2)}</td>
                {session && (
                  <td>
                    {row ? (
                      <>
                        <button onClick={() => {
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
                        }}>Düzenle</button>
                        <button style={{ marginLeft: 6 }} onClick={async () => {
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
                        }}>Sil</button>
                      </>
                    ) : (
                      <button onClick={() => {
                        // Devamsız gün için yeni kayıt ekle
                        setEditing({ isNew: true, kullanici_id: calisan.kullanici_id ?? calisan.id, displayDate: g.tarih });
                        setLockChecked(false);
                        setEditValues({ giris: `${g.tarih}T08:00`, cikis: `${g.tarih}T17:00` });
                      }}>Ekle</button>
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
    </div>
  );
}

export default CalisanDetay;
