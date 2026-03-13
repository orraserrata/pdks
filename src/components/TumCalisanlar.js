import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { format, eachDayOfInterval, addDays } from "date-fns";
import { tr as trLocale } from "date-fns/locale";

function TumCalisanlar() {
  const [personeller, setPersoneller] = useState([]);
  const [calisanDetaylari, setCalisanDetaylari] = useState({});
  const [baslangic, setBaslangic] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bitis, setBitis] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active"); // "all", "active", "inactive"
  const dayStartHour = 5;

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
      const { data, error } = await supabase
        .from("personel_giris_cikis_duzenli")
        .select("*")
        .gte("giris_tarihi", baslangic)
        .lt("giris_tarihi", endExclusive)
        .order("giris_tarihi", { ascending: true });

      if (error) {
        console.error("Hata:", error);
        return;
      }

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

        detaylar[calisan.kullanici_id] = {
          toplamSure: toplamSure.toFixed(2),
          kayitSayisi: new Set(calisanKayitlari.map(k => k.workday_date || k.giris_tarihi?.split('T')[0])).size
        };
      });

      setCalisanDetaylari(detaylar);
    }

    fetchCalisanDetaylari();
  }, [personeller, baslangic, bitis]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const printContent = `
      <html>
        <head>
          <title>PDKS - Tüm Çalışanlar Raporu</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header { text-align: center; margin-bottom: 20px; }
            .date-range { margin-bottom: 20px; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>PDKS - Tüm Çalışanlar Raporu</h1>
            <div class="date-range">
              <strong>Tarih Aralığı:</strong> ${format(new Date(baslangic), "dd.MM.yyyy")} - ${format(new Date(bitis), "dd.MM.yyyy")}
            </div>
          </div>
          <table>
                    <thead>
          <tr>
            <th>Sıra</th>
            <th>Ad Soyad</th>
            <th>Kullanıcı ID</th>
            <th>Durum</th>
            <th>Toplam Süre (Saat)</th>
            <th>İşe Gelinen Gün</th>
          </tr>
        </thead>
            <tbody>
              ${personeller.map((calisan, index) => {
                const detay = calisanDetaylari[calisan.kullanici_id] || { toplamSure: "0.00", kayitSayisi: 0 };
                return `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${(calisan.isim || "")} ${(calisan.soyisim || "")}</td>
                    <td>${calisan.kullanici_id}</td>
                    <td>${calisan.aktif ? "Aktif" : "Pasif"}</td>
                    <td>${detay.toplamSure}</td>
                    <td>${detay.kayitSayisi}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <div style="margin-top: 20px;">
            <strong>Toplam Çalışan Sayısı:</strong> ${personeller.length}
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <div>
      <h2>Tüm Çalışanlar Raporu</h2>
      
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

      <div className="responsive-flex" style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>Başlangıç:</label>
          <input 
            type="date" 
            value={baslangic} 
            onChange={(e) => setBaslangic(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>Bitiş:</label>
          <input 
            type="date" 
            value={bitis} 
            onChange={(e) => setBitis(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }}
          />
        </div>
        <button 
          onClick={handlePrint}
          style={{ 
            padding: "10px 16px", 
            backgroundColor: "#007bff", 
            color: "white", 
            border: "none", 
            borderRadius: "6px", 
            cursor: "pointer",
            fontWeight: "600",
            minHeight: "44px"
          }}
        >
          🖨️ Yazdır
        </button>
      </div>

      <table border="1" className="mobile-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Sıra</th>
            <th>Ad Soyad</th>
            <th>Kullanıcı ID</th>
            <th>Durum</th>
            <th>Toplam Süre (Saat)</th>
            <th>İşe Gelinen Gün</th>
          </tr>
        </thead>
        <tbody>
          {personeller.map((calisan, index) => {
            const detay = calisanDetaylari[calisan.kullanici_id] || { toplamSure: "0.00", kayitSayisi: 0 };
            return (
              <tr key={calisan.kullanici_id}>
                <td data-label="Sıra">{index + 1}</td>
                <td data-label="Ad Soyad">{(calisan.isim || "")} {(calisan.soyisim || "")}</td>
                <td data-label="Kullanıcı ID">{calisan.kullanici_id}</td>
                <td data-label="Durum">
                  <span style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: "500",
                    backgroundColor: calisan.aktif ? "#dcfce7" : "#fee2e2",
                    color: calisan.aktif ? "#166534" : "#dc2626"
                  }}>
                    {calisan.aktif ? "Aktif" : "Pasif"}
                  </span>
                </td>
                <td data-label="Toplam Süre (Saat)">{detay.toplamSure}</td>
                <td data-label="İşe Gelinen Gün">{detay.kayitSayisi}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan="3" style={{ textAlign: "right", fontWeight: "bold" }}>
              Toplam Çalışan:
            </td>
            <td>{personeller.length}</td>
            <td colSpan="2"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default TumCalisanlar;
