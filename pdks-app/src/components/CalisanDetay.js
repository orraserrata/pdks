import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { format, eachDayOfInterval, addDays, startOfWeek, endOfWeek } from "date-fns";

function CalisanDetay({ calisan }) {
  const [girisCikis, setGirisCikis] = useState([]);
  const [baslangic, setBaslangic] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bitis, setBitis] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    async function fetchGirisCikis() {
      if (!calisan) return;
      const { data, error } = await supabase
        .from("personel_giris_cikis_duzenli")
        .select("*")
        .eq("kullanici_id", calisan.id)
        .gte("giris_tarihi", baslangic)
        .lte("giris_tarihi", bitis)
        .order("giris_tarihi", { ascending: true });

      if (error) console.error("Hata:", error);
      else setGirisCikis(data || []);
    }
    fetchGirisCikis();
  }, [calisan, baslangic, bitis]);

  const gunler = eachDayOfInterval({
    start: new Date(baslangic),
    end: new Date(bitis),
  });

  // Günlük kayıtları ve süreyi hesapla
  const gunlerWithData = gunler.map((gun) => {
    const dateStr = format(gun, "yyyy-MM-dd");
    const kayitlar = girisCikis.filter(g =>
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
        sure
      };
    });
  }).flat();

  // Toplam süre
  const toplamSure = gunlerWithData.reduce((sum, g) => sum + g.sure, 0).toFixed(2);

  return (
    <div>
      <h2>{calisan.isim} {calisan.soyisim} Devamsızlık</h2>

      <label>
        Başlangıç:
        <input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} />
      </label>
      <label style={{ marginLeft: "10px" }}>
        Bitiş:
        <input type="date" value={bitis} onChange={(e) => setBitis(e.target.value)} />
      </label>

      <table border="1" style={{ marginTop: "10px", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Giriş</th>
            <th>Çıkış</th>
            <th>Süre (saat)</th>
          </tr>
        </thead>
        <tbody>
          {gunlerWithData.map((g, i) => (
            <tr key={i}>
              <td>{g.tarih}</td>
              <td>{g.giris}</td>
              <td>{g.cikis}</td>
              <td>{g.sure.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan="3" style={{ textAlign: "right" }}>Toplam Süre:</td>
            <td>{toplamSure} saat</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default CalisanDetay;
