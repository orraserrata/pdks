import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import {
  fetchMaasHedefleri,
  saveMaasHedef,
  calcBirimUcret,
  getHedefDeger,
  DEFAULT_HEDEFLER,
} from '../utils/maasHedefleri';

const MAAS_TIPI_TABS = [
  { value: 'saatli', label: 'Saatlik Maaş Alanlar' },
  { value: 'gunluk', label: 'Gün Bazlı Maaş Alanlar' },
];

function getPersonelMaasTipi(personel) {
  return personel?.maas_tipi || 'saatli';
}

const MaasHesabi = () => {
  const [maasAyarlari, setMaasAyarlari] = useState([]);
  const [maasRaporu, setMaasRaporu] = useState([]);
  const [availablePersonel, setAvailablePersonel] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('raporlar');
  const [settingsMaasTipi, setSettingsMaasTipi] = useState('saatli');
  const [reportMaasTipi, setReportMaasTipi] = useState('saatli');
  
  // Maaş ayarları için state'ler
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedPersonel, setSelectedPersonel] = useState('');
  const [addSalary, setAddSalary] = useState('');
  const [editingSalary, setEditingSalary] = useState(null);
  const [newSalary, setNewSalary] = useState('');

  const [hedefAyarlari, setHedefAyarlari] = useState({ ...DEFAULT_HEDEFLER });
  const [hedefInputs, setHedefInputs] = useState({ ...DEFAULT_HEDEFLER });
  const [hedefSaving, setHedefSaving] = useState(false);
  
  // Maaş raporu için state'ler
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    { value: 1, label: 'Ocak' },
    { value: 2, label: 'Şubat' },
    { value: 3, label: 'Mart' },
    { value: 4, label: 'Nisan' },
    { value: 5, label: 'Mayıs' },
    { value: 6, label: 'Haziran' },
    { value: 7, label: 'Temmuz' },
    { value: 8, label: 'Ağustos' },
    { value: 9, label: 'Eylül' },
    { value: 10, label: 'Ekim' },
    { value: 11, label: 'Kasım' },
    { value: 12, label: 'Aralık' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const filteredMaasAyarlari = useMemo(() => {
    return maasAyarlari.filter(
      (ayar) => getPersonelMaasTipi(ayar.personel) === settingsMaasTipi
    );
  }, [maasAyarlari, settingsMaasTipi]);

  const filteredAvailablePersonel = useMemo(() => {
    return availablePersonel.filter(
      (p) => (p.maas_tipi || 'saatli') === settingsMaasTipi
        && !maasAyarlari.some((ma) => ma.kullanici_id === p.kullanici_id)
    );
  }, [availablePersonel, maasAyarlari, settingsMaasTipi]);

  const isGunluk = settingsMaasTipi === 'gunluk';
  const isReportGunluk = reportMaasTipi === 'gunluk';

  const filteredMaasRaporu = useMemo(() => {
    return maasRaporu.filter((rapor) => rapor.maas_tipi === reportMaasTipi);
  }, [maasRaporu, reportMaasTipi]);

  useEffect(() => {
    loadHedefAyarlari();
    fetchMaasAyarlari();
    fetchAvailablePersonel();
  }, []);

  useEffect(() => {
    fetchMaasRaporu();
  }, [selectedMonth, selectedYear, hedefAyarlari]);

  const loadHedefAyarlari = async () => {
    const { hedefler, error } = await fetchMaasHedefleri();
    if (!error) {
      setHedefAyarlari(hedefler);
      setHedefInputs(hedefler);
    }
  };

  const handleSaveHedefAyarlari = async () => {
    const saatli = parseInt(hedefInputs.saatli, 10);
    const gunluk = parseInt(hedefInputs.gunluk, 10);
    if (!saatli || saatli <= 0 || !gunluk || gunluk <= 0) {
      alert('Hedef saat ve hedef gün pozitif bir sayı olmalıdır.');
      return;
    }

    setHedefSaving(true);
    try {
      const { error: saatliErr } = await saveMaasHedef('saatli', saatli);
      if (saatliErr) throw saatliErr;
      const { error: gunlukErr } = await saveMaasHedef('gunluk', gunluk);
      if (gunlukErr) throw gunlukErr;

      const yeni = { saatli, gunluk };
      setHedefAyarlari(yeni);
      setHedefInputs(yeni);
      alert('Hedef ayarları kaydedildi.');
    } catch (err) {
      alert('Hedef kaydedilemedi: ' + (err.message || err));
    } finally {
      setHedefSaving(false);
    }
  };

  const fetchMaasAyarlari = async () => {
    try {
      const { data, error } = await supabase
        .from('maas_ayarlari')
        .select(`
          *,
          personel:kullanici_id (
            kullanici_id,
            isim,
            soyisim,
            maas_tipi
          )
        `)
        .eq('aktif', true)
        .order('kullanici_id');

      if (error) throw error;
      setMaasAyarlari(data || []);
    } catch (error) {
      console.error('Maaş ayarları yükleme hatası:', error);
    }
  };

  const fetchMaasRaporu = async () => {
    try {
      setLoading(true);
      
      const { data: maasData, error: maasError } = await supabase
        .from('maas_ayarlari')
        .select(`
          *,
          personel:kullanici_id (
            kullanici_id,
            isim,
            soyisim,
            maas_tipi
          )
        `)
        .eq('aktif', true);

      if (maasError) throw maasError;

      const raporData = [];
      
      for (const maas of maasData || []) {
        const maasTipi = getPersonelMaasTipi(maas.personel);

        const { data: calismaData, error: calismaError } = await supabase
          .from('personel_giris_cikis_duzenli')
          .select('giris_tarihi, cikis_tarihi, workday_date')
          .eq('kullanici_id', maas.kullanici_id)
          .gte('giris_tarihi', `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`)
          .lt('giris_tarihi', `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-01`);

        if (calismaError) {
          console.error('Çalışma verisi yükleme hatası:', calismaError);
          continue;
        }

        if (maasTipi === 'gunluk') {
          // Tüm Çalışanlar raporu ile aynı mantık: giriş/çıkış eksik olsa da
          // o iş gününde kayıt varsa tam gün sayılır
          const gunler = new Set();
          calismaData?.forEach((record) => {
            const day = record.workday_date || record.giris_tarihi?.split('T')[0];
            if (day) gunler.add(day);
          });

          const calisilanGun = gunler.size;
          const hedef = getHedefDeger('gunluk', hedefAyarlari);
          const gunlukUcret = calcBirimUcret(maas.aylik_maas, 'gunluk', hedefAyarlari);
          const hesaplananMaas = calisilanGun * gunlukUcret;
          const fark = hesaplananMaas - maas.aylik_maas;

          raporData.push({
            kullanici_id: maas.kullanici_id,
            isim: maas.personel?.isim || '',
            soyisim: maas.personel?.soyisim || '',
            maas_tipi: 'gunluk',
            aylik_maas: maas.aylik_maas,
            hedef,
            calisilan: calisilanGun,
            birim_ucret: gunlukUcret,
            hesaplanan_maas: hesaplananMaas,
            fark,
          });
        } else {
          let toplamSaat = 0;
          calismaData?.forEach((record) => {
            if (record.cikis_tarihi) {
              const giris = new Date(record.giris_tarihi);
              const cikis = new Date(record.cikis_tarihi);
              const saatFarki = (cikis - giris) / (1000 * 60 * 60);
              toplamSaat += saatFarki;
            }
          });

          const hedef = getHedefDeger('saatli', hedefAyarlari);
          const saatlikUcret = calcBirimUcret(maas.aylik_maas, 'saatli', hedefAyarlari);
          const hesaplananMaas = toplamSaat * saatlikUcret;
          const fark = hesaplananMaas - maas.aylik_maas;

          raporData.push({
            kullanici_id: maas.kullanici_id,
            isim: maas.personel?.isim || '',
            soyisim: maas.personel?.soyisim || '',
            maas_tipi: 'saatli',
            aylik_maas: maas.aylik_maas,
            hedef,
            calisilan: toplamSaat,
            birim_ucret: saatlikUcret,
            hesaplanan_maas: hesaplananMaas,
            fark,
          });
        }
      }

      raporData.sort((a, b) => {
        const nameA = `${a.isim} ${a.soyisim}`.toLowerCase();
        const nameB = `${b.isim} ${b.soyisim}`.toLowerCase();
        return nameA.localeCompare(nameB, 'tr');
      });

      setMaasRaporu(raporData);
    } catch (error) {
      console.error('Maaş raporu yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailablePersonel = async () => {
    try {
      const { data, error } = await supabase
        .from('personel')
        .select('kullanici_id, isim, soyisim, maas_tipi')
        .eq('aktif', true)
        .order('isim');

      if (error) throw error;
      setAvailablePersonel(data || []);
    } catch (error) {
      console.error('Personel yükleme hatası:', error);
    }
  };

  const addNewSalary = async () => {
    if (!selectedPersonel || !addSalary) {
      alert('Lütfen personel ve aylık maaş alanlarını doldurun');
      return;
    }

    const existing = maasAyarlari.find(ma => ma.kullanici_id === parseInt(selectedPersonel));
    if (existing) {
      alert('Bu personel için zaten maaş ayarı mevcut');
      return;
    }

    try {
      const { error } = await supabase
        .from('maas_ayarlari')
        .insert({
          kullanici_id: parseInt(selectedPersonel),
          aylik_maas: parseFloat(addSalary),
          hedef_saat: hedefAyarlari.saatli,
          aktif: true
        });

      if (error) throw error;

      alert('Maaş ayarı başarıyla eklendi');
      setShowAddForm(false);
      setSelectedPersonel('');
      setAddSalary('');
      fetchMaasAyarlari();
      fetchMaasRaporu();
    } catch (error) {
      console.error('Maaş ekleme hatası:', error);
      alert('Maaş eklenirken hata oluştu: ' + error.message);
    }
  };

  const updateSalary = async (kullaniciId) => {
    if (!newSalary) {
      alert('Lütfen aylık maaş alanını doldurun');
      return;
    }

    try {
      const { error } = await supabase
        .from('maas_ayarlari')
        .update({
          aylik_maas: parseFloat(newSalary),
        })
        .eq('kullanici_id', kullaniciId);

      if (error) throw error;

      alert('Maaş ayarı başarıyla güncellendi');
      setEditingSalary(null);
      setNewSalary('');
      fetchMaasAyarlari();
      fetchMaasRaporu();
    } catch (error) {
      console.error('Maaş güncelleme hatası:', error);
      alert('Maaş güncellenirken hata oluştu: ' + error.message);
    }
  };

  const formatCalisilan = (rapor) => {
    if (rapor.maas_tipi === 'gunluk') {
      return `${rapor.calisilan} gün`;
    }
    return formatHours(rapor.calisilan);
  };

  const formatHedef = (rapor) => {
    if (rapor.maas_tipi === 'gunluk') {
      return `${rapor.hedef} gün`;
    }
    return `${rapor.hedef} saat`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  };

  const formatHours = (hours) => {
    if (hours === 0) return '0 saat';
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours} saat ${minutes} dakika`;
  };

  const handlePrint = () => {
    const printContent = document.getElementById(`maas-raporu-tablosu-${reportMaasTipi}`);
    if (printContent) {
      const raporBaslik = isReportGunluk ? 'Gün Bazlı Maaş Raporu' : 'Saatlik Maaş Raporu';
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>${raporBaslik} - ${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f5f5f5; font-weight: bold; }
              .positive { color: #28a745; font-weight: bold; }
              .negative { color: #dc3545; font-weight: bold; }
            </style>
          </head>
          <body>
            <h2>${raporBaslik} - ${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}</h2>
            ${printContent.outerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div>
      <h2>Maaş Hesabı</h2>
      
      {/* Alt Sekmeler */}
      <div style={{ marginBottom: '20px' }}>
        <div className="responsive-flex" style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #ddd' }}>
          <button
            onClick={() => setActiveSubTab('raporlar')}
            style={{
              padding: '10px 20px',
              backgroundColor: activeSubTab === 'raporlar' ? '#007bff' : 'transparent',
              color: activeSubTab === 'raporlar' ? 'white' : '#007bff',
              border: 'none',
              borderBottom: activeSubTab === 'raporlar' ? '2px solid #007bff' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Maaş Raporları
          </button>
          <button
            onClick={() => setActiveSubTab('ayarlar')}
            style={{
              padding: '10px 20px',
              backgroundColor: activeSubTab === 'ayarlar' ? '#007bff' : 'transparent',
              color: activeSubTab === 'ayarlar' ? 'white' : '#007bff',
              border: 'none',
              borderBottom: activeSubTab === 'ayarlar' ? '2px solid #007bff' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Maaş Ayarları
          </button>
        </div>
      </div>

      {/* Maaş Raporları Sekmesi */}
      {activeSubTab === 'raporlar' && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <div className="responsive-flex" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {MAAS_TIPI_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setReportMaasTipi(tab.value)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: reportMaasTipi === tab.value
                      ? (tab.value === 'gunluk' ? '#4f46e5' : '#d97706')
                      : '#f3f4f6',
                    color: reportMaasTipi === tab.value ? 'white' : '#374151',
                    border: `1px solid ${reportMaasTipi === tab.value
                      ? (tab.value === 'gunluk' ? '#4f46e5' : '#d97706')
                      : '#d1d5db'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                  }}
                >
                  {tab.value === 'saatli' ? '⏱️' : '📅'} {tab.label}
                  <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.9 }}>
                    ({maasRaporu.filter((r) => r.maas_tipi === tab.value).length})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Ay/Yıl Seçimi */}
          <div className="responsive-flex" style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label>
              Ay:
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                style={{ marginLeft: '5px', padding: '5px' }}
              >
                {months.map(month => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </label>
            
            <label>
              Yıl:
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                style={{ marginLeft: '5px', padding: '5px' }}
              >
                {years.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            
            <button 
              onClick={fetchMaasRaporu}
              style={{ padding: '5px 10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              Yenile
            </button>
            
            <button 
              onClick={handlePrint}
              style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              🖨️ Yazdır
            </button>
          </div>

          {/* Maaş Raporu Tablosu */}
          <div>
            <h3>
              {isReportGunluk ? 'Gün Bazlı Maaş Raporu' : 'Saatlik Maaş Raporu'}
              {' - '}{months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </h3>
            {loading ? (
              <p>Yükleniyor...</p>
            ) : (
              <div className="mobile-scroll-wrap" style={{ overflowX: 'auto' }}>
                <table
                  id={`maas-raporu-tablosu-${reportMaasTipi}`}
                  className="mobile-scroll-table"
                  style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}
                >
                  <thead>
                    <tr style={{ backgroundColor: isReportGunluk ? '#eef2ff' : '#fffbeb' }}>
                      <th style={{ border: '1px solid #ddd', padding: '8px' }}>Kullanıcı ID</th>
                      <th style={{ border: '1px solid #ddd', padding: '8px' }}>Ad Soyad</th>
                      <th style={{ border: '1px solid #ddd', padding: '8px' }}>Aylık Maaş</th>
                      <th style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {isReportGunluk ? 'Hedef Gün' : 'Hedef Saat'}
                      </th>
                      <th style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {isReportGunluk ? 'Çalışılan Gün' : 'Çalışılan Saat'}
                      </th>
                      <th style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {isReportGunluk ? 'Günlük Ücret' : 'Saatlik Ücret'}
                      </th>
                      <th style={{ border: '1px solid #ddd', padding: '8px' }}>Hesaplanan Maaş</th>
                      <th style={{ border: '1px solid #ddd', padding: '8px' }}>Fark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaasRaporu.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ border: '1px solid #ddd', padding: '16px', textAlign: 'center', color: '#6b7280' }}>
                          Bu kategoride rapor verisi bulunmuyor.
                        </td>
                      </tr>
                    ) : filteredMaasRaporu.map((rapor) => (
                      <tr key={rapor.kullanici_id}>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{rapor.kullanici_id}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                          {rapor.isim} {rapor.soyisim}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                          {formatCurrency(rapor.aylik_maas)}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                          {formatHedef(rapor)}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                          {formatCalisilan(rapor)}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                          {formatCurrency(rapor.birim_ucret)}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                          {formatCurrency(rapor.hesaplanan_maas)}
                        </td>
                        <td style={{ 
                          border: '1px solid #ddd', 
                          padding: '8px',
                          color: rapor.fark >= 0 ? '#28a745' : '#dc3545',
                          fontWeight: 'bold'
                        }}>
                          {rapor.fark >= 0 ? '+' : ''}{formatCurrency(rapor.fark)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Maaş Ayarları Sekmesi */}
      {activeSubTab === 'ayarlar' && (
        <div>
          {/* Merkezi hedef ayarları */}
          <div style={{
            marginBottom: '24px',
            padding: '20px',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            backgroundColor: '#eff6ff',
          }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#1e40af' }}>Genel Hedef Ayarları</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#374151' }}>
              Tüm saatlik personel için hedef saat ve tüm günlük personel için hedef gün buradan tek seferde güncellenir.
            </p>
            <div className="responsive-flex" style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                  Hedef Saat (Saatlik)
                </label>
                <input
                  type="number"
                  value={hedefInputs.saatli}
                  onChange={(e) => setHedefInputs((prev) => ({ ...prev, saatli: e.target.value }))}
                  style={{ padding: '8px 12px', width: '120px', border: '1px solid #93c5fd', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                  Hedef Gün (Günlük)
                </label>
                <input
                  type="number"
                  value={hedefInputs.gunluk}
                  onChange={(e) => setHedefInputs((prev) => ({ ...prev, gunluk: e.target.value }))}
                  style={{ padding: '8px 12px', width: '120px', border: '1px solid #93c5fd', borderRadius: '6px' }}
                />
              </div>
              <button
                onClick={handleSaveHedefAyarlari}
                disabled={hedefSaving}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: hedefSaving ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                }}
              >
                {hedefSaving ? 'Kaydediliyor...' : 'Hedefleri Kaydet'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div className="responsive-flex" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {MAAS_TIPI_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => {
                    setSettingsMaasTipi(tab.value);
                    setShowAddForm(false);
                    setEditingSalary(null);
                    setSelectedPersonel('');
                    setAddSalary('');
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: settingsMaasTipi === tab.value
                      ? (tab.value === 'gunluk' ? '#4f46e5' : '#d97706')
                      : '#f3f4f6',
                    color: settingsMaasTipi === tab.value ? 'white' : '#374151',
                    border: `1px solid ${settingsMaasTipi === tab.value
                      ? (tab.value === 'gunluk' ? '#4f46e5' : '#d97706')
                      : '#d1d5db'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                  }}
                >
                  {tab.value === 'saatli' ? '⏱️' : '📅'} {tab.label}
                  <span style={{
                    marginLeft: '8px',
                    fontSize: '12px',
                    opacity: 0.9,
                  }}>
                    ({maasAyarlari.filter((a) => getPersonelMaasTipi(a.personel) === tab.value).length})
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ margin: 0 }}>
                {isGunluk ? 'Gün Bazlı Maaş Ayarları' : 'Saatlik Maaş Ayarları'}
              </h3>
              <button 
                onClick={() => setShowAddForm(true)}
                style={{ 
                  padding: '8px 16px', 
                  backgroundColor: '#28a745', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                + Yeni Maaş Ayarı Ekle
              </button>
            </div>

            {/* Yeni Maaş Ayarı Ekleme Formu */}
            {showAddForm && (
              <div style={{ 
                border: '1px solid #ddd', 
                padding: '15px', 
                marginBottom: '15px', 
                borderRadius: '4px',
                backgroundColor: '#f9f9f9'
              }}>
                <h4>
                  Yeni {isGunluk ? 'Gün Bazlı' : 'Saatlik'} Maaş Ayarı Ekle
                </h4>
                <div className="responsive-flex" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <label>Personel:</label>
                    <select
                      value={selectedPersonel}
                      onChange={(e) => setSelectedPersonel(e.target.value)}
                      style={{ marginLeft: '5px', padding: '5px', minWidth: '200px' }}
                    >
                      <option value="">Personel Seçin</option>
                      {filteredAvailablePersonel.map(personel => (
                        <option key={personel.kullanici_id} value={personel.kullanici_id}>
                          {personel.kullanici_id} - {personel.isim} {personel.soyisim}
                        </option>
                      ))}
                      {filteredAvailablePersonel.length === 0 && (
                        <option value="" disabled>
                          Bu kategoride eklenecek personel yok
                        </option>
                      )}
                    </select>
                  </div>
                  
                  <div>
                    <label>Aylık Maaş:</label>
                    <input
                      type="number"
                      value={addSalary}
                      onChange={(e) => setAddSalary(e.target.value)}
                      placeholder="40000"
                      style={{ marginLeft: '5px', padding: '5px', width: '120px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      onClick={addNewSalary}
                      style={{ 
                        padding: '5px 10px', 
                        backgroundColor: '#007bff', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      Ekle
                    </button>
                    <button
                      onClick={() => {
                        setShowAddForm(false);
                        setSelectedPersonel('');
                        setAddSalary('');
                      }}
                      style={{ 
                        padding: '5px 10px', 
                        backgroundColor: '#6c757d', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      İptal
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Maaş Ayarları Tablosu */}
            <div className="mobile-scroll-wrap" style={{ overflowX: 'auto' }}>
              <table className="mobile-scroll-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
                <thead>
                  <tr style={{ backgroundColor: isGunluk ? '#eef2ff' : '#fffbeb' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>Kullanıcı ID</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>Ad Soyad</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>Aylık Maaş</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>
                      {isGunluk ? 'Günlük Ücret' : 'Saatlik Ücret'}
                    </th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaasAyarlari.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ border: '1px solid #ddd', padding: '16px', textAlign: 'center', color: '#6b7280' }}>
                        Bu kategoride aktif personel bulunmuyor.
                      </td>
                    </tr>
                  ) : filteredMaasAyarlari.map((ayar) => {
                    const tip = getPersonelMaasTipi(ayar.personel);
                    const birimUcret = calcBirimUcret(ayar.aylik_maas, tip, hedefAyarlari);
                    return (
                    <tr key={ayar.kullanici_id}>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{ayar.kullanici_id}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {ayar.personel?.isim} {ayar.personel?.soyisim}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {editingSalary === ayar.kullanici_id ? (
                          <input
                            type="number"
                            value={newSalary}
                            onChange={(e) => setNewSalary(e.target.value)}
                            placeholder="Aylık maaş"
                            style={{ width: '100px', padding: '4px' }}
                          />
                        ) : (
                          formatCurrency(ayar.aylik_maas)
                        )}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {formatCurrency(birimUcret)}
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>
                          (Hedef: {getHedefDeger(tip, hedefAyarlari)} {isGunluk ? 'gün' : 'saat'})
                        </div>
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {editingSalary === ayar.kullanici_id ? (
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button
                              onClick={() => updateSalary(ayar.kullanici_id)}
                              style={{ 
                                padding: '4px 8px', 
                                backgroundColor: '#28a745', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '3px',
                                cursor: 'pointer'
                              }}
                            >
                              Kaydet
                            </button>
                            <button
                              onClick={() => {
                                setEditingSalary(null);
                                setNewSalary('');
                              }}
                              style={{ 
                                padding: '4px 8px', 
                                backgroundColor: '#6c757d', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '3px',
                                cursor: 'pointer'
                              }}
                            >
                              İptal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingSalary(ayar.kullanici_id);
                              setNewSalary(ayar.aylik_maas.toString());
                            }}
                            style={{ 
                              padding: '4px 8px', 
                              backgroundColor: '#007bff', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          >
                            Düzenle
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaasHesabi;