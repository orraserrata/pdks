import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { format, addDays } from "date-fns";
import { calcIzinGunInRange } from "../utils/yillikIzin";
import LoadingSpinner from "./LoadingSpinner";

function formatYillikIzinGun(gun) {
  return gun > 0 ? String(gun) : "-";
}

function TumCalisanlar() {
  const [personeller, setPersoneller] = useState([]);
  const [calisanDetaylari, setCalisanDetaylari] = useState({});
  const [baslangic, setBaslangic] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bitis, setBitis] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active"); // "all", "active", "inactive"

  useEffect(() => {
    async function fetchPersoneller() {
      let query = supabase
        .from('personel')
        .select('kullanici_id, isim, soyisim, aktif')
        .order('isim', { ascending: true });
      
      // Filtreleme uygula
      if (filter === "active") {
        query = query.eq('aktif', true);
      } else if (filter === "inactive") {
        query = query.eq('aktif', false);
      }
      // "all" için filtre uygulanmaz, tüm personeller gelir

      const { data, error } = await query;

      if (error) {
        console.error('Veri çekme hatası:', error);
        setPersoneller([]);
      } else {
        setPersoneller(data || []);
      }
      setLoading(false);
    }

    fetchPersoneller();
  }, [filter]);

  useEffect(() => {
    async function fetchCalisanDetaylari() {
      if (personeller.length === 0) return;

      const endExclusive = format(addDays(new Date(bitis), 1), "yyyy-MM-dd");
      const [{ data, error }, { data: izinData, error: izinError }] = await Promise.all([
        supabase
          .from("personel_giris_cikis_duzenli")
          .select("*")
          .gte("giris_tarihi", baslangic)
          .lt("giris_tarihi", endExclusive)
          .order("giris_tarihi", { ascending: true }),
        supabase
          .from("izin_talepleri")
          .select("kullanici_id, baslangic_tarihi, bitis_tarihi")
          .eq("durum", "onaylandi")
          .eq("izin_tipi", "yillik_izin")
          .lte("baslangic_tarihi", bitis)
          .gt("bitis_tarihi", baslangic),
      ]);

      if (error) {
        console.error("Hata:", error);
        return;
      }

      if (izinError) {
        console.error("İzin verisi hatası:", izinError);
      }

      const izinKayitlari = izinData || [];

      // Her çalışan için toplam süreyi hesapla
      const detaylar = {};
      personeller.forEach(calisan => {
        const calisanKayitlari = data.filter(k => k.kullanici_id === calisan.kullanici_id);
        let toplamSure = 0;

        calisanKayitlari.forEach(kayit => {
          const girisDt = new Date(kayit.giris_tarihi);
          const cikisDt = kayit.cikis_tarihi ? new Date(kayit.cikis_tarihi) : null;
          if (cikisDt) {
            toplamSure += (cikisDt - girisDt) / (1000 * 60 * 60);
          }
        });

        const kisiIzinleri = izinKayitlari.filter((t) => t.kullanici_id === calisan.kullanici_id);
        let yillikIzinGun = 0;
        kisiIzinleri.forEach((t) => {
          yillikIzinGun += calcIzinGunInRange(
            t.baslangic_tarihi,
            t.bitis_tarihi,
            baslangic,
            bitis
          );
        });

        detaylar[calisan.kullanici_id] = {
          toplamSure: toplamSure.toFixed(2),
          kayitSayisi: new Set(calisanKayitlari.map(k => k.workday_date || k.giris_tarihi?.split('T')[0])).size,
          yillikIzinGun,
        };
      });

      setCalisanDetaylari(detaylar);
    }

    fetchCalisanDetaylari();
  }, [personeller, baslangic, bitis]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const tarihAraligi = `${format(new Date(baslangic), "dd.MM.yyyy")} - ${format(new Date(bitis), "dd.MM.yyyy")}`;
    const raporBaslik = `Lulus Personel - Çalışan Raporu (${tarihAraligi})`;
    const printContent = `
      <html>
        <head>
          <title>${raporBaslik}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #9ca3af; padding: 8px; text-align: center; }
            th { background-color: #e5e7eb; }
            tbody tr:nth-child(even) { background-color: #f3f4f6; }
            tbody tr:nth-child(odd) { background-color: #ffffff; }
            .header { text-align: center; margin-bottom: 20px; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${raporBaslik}</h1>
          </div>
          <table>
                    <thead>
          <tr>
            <th>Sıra</th>
            <th>Ad Soyad</th>
            <th>Toplam Süre (Saat)</th>
            <th>İşe Gelinen Gün</th>
            <th>Kullanılan Yıllık İzin</th>
          </tr>
        </thead>
            <tbody>
              ${personeller.map((calisan, index) => {
                const detay = calisanDetaylari[calisan.kullanici_id] || { toplamSure: "0.00", kayitSayisi: 0, yillikIzinGun: 0 };
                return `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${(calisan.isim || "")} ${(calisan.soyisim || "")}</td>
                    <td>${detay.toplamSure}</td>
                    <td>${detay.kayitSayisi}</td>
                    <td>${formatYillikIzinGun(detay.yillikIzinGun)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) return <LoadingSpinner className="loader-wrap--page" />;

  return (
    <div>
      <h2>Çalışan Raporu</h2>
      
      {/* Filtreleme Butonları */}
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

      <div className="rapor-toolbar">
        <div className="calisan-date-filters">
          <div className="calisan-date-field">
            <label>Başlangıç</label>
            <input
              type="date"
              value={baslangic}
              onChange={(e) => setBaslangic(e.target.value)}
            />
          </div>
          <div className="calisan-date-field">
            <label>Bitiş</label>
            <input
              type="date"
              value={bitis}
              onChange={(e) => setBitis(e.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="rapor-print-btn"
        >
          Yazdır
        </button>
      </div>

      <table className="rapor-table mobile-table">
        <thead>
          <tr>
            <th>Sıra</th>
            <th>Ad Soyad</th>
            <th>Toplam Süre (Saat)</th>
            <th>İşe Gelinen Gün</th>
            <th>Kullanılan Yıllık İzin</th>
          </tr>
        </thead>
        <tbody>
          {personeller.map((calisan, index) => {
            const detay = calisanDetaylari[calisan.kullanici_id] || { toplamSure: "0.00", kayitSayisi: 0, yillikIzinGun: 0 };
            return (
              <tr key={calisan.kullanici_id}>
                <td data-label="Sıra">{index + 1}</td>
                <td data-label="Ad Soyad">{(calisan.isim || "")} {(calisan.soyisim || "")}</td>
                <td data-label="Toplam Süre (Saat)">{detay.toplamSure}</td>
                <td data-label="İşe Gelinen Gün">{detay.kayitSayisi}</td>
                <td data-label="Kullanılan Yıllık İzin">{formatYillikIzinGun(detay.yillikIzinGun)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default TumCalisanlar;
