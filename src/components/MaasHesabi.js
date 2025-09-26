import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const MaasHesabi = () => {
  const [maasAyarlari, setMaasAyarlari] = useState([]);
  const [maasRaporu, setMaasRaporu] = useState([]);
  const [availablePersonel, setAvailablePersonel] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('raporlar');
  
  // Maaş ayarları için state'ler
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedPersonel, setSelectedPersonel] = useState('');
  const [addSalary, setAddSalary] = useState('');
  const [addTargetHours, setAddTargetHours] = useState('');
  const [editingSalary, setEditingSalary] = useState(null);
  const [newSalary, setNewSalary] = useState('');
  const [newTargetHours, setNewTargetHours] = useState('');
  
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

  useEffect(() => {
    fetchMaasAyarlari();
    fetchAvailablePersonel();
    fetchMaasRaporu();
  }, []);

  useEffect(() => {
    fetchMaasRaporu();
  }, [selectedMonth, selectedYear]);

  const fetchMaasAyarlari = async () => {
    try {
      const { data, error } = await supabase
        .from('maas_ayarlari')
        .select(`
          *,
          personel:kullanici_id (
            kullanici_id,
            isim,
            soyisim
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
      
      // Maaş ayarlarından veri çek
      const { data: maasData, error: maasError } = await supabase
        .from('maas_ayarlari')
        .select(`
          *,
          personel:kullanici_id (
            kullanici_id,
            isim,
            soyisim
          )
        `)
        .eq('aktif', true);

      if (maasError) throw maasError;

      // Her personel için çalışma saatlerini hesapla
      const raporData = [];
      
      for (const maas of maasData || []) {
        const { data: calismaData, error: calismaError } = await supabase
          .from('personel_giris_cikis_duzenli')
          .select('giris_tarihi, cikis_tarihi')
          .eq('kullanici_id', maas.kullanici_id)
          .gte('giris_tarihi', `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`)
          .lt('giris_tarihi', `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-01`);

        if (calismaError) {
          console.error('Çalışma saatleri yükleme hatası:', calismaError);
          continue;
        }

        // Toplam çalışma saatini hesapla
        let toplamSaat = 0;
        calismaData?.forEach(record => {
          if (record.cikis_tarihi) {
            const giris = new Date(record.giris_tarihi);
            const cikis = new Date(record.cikis_tarihi);
            const saatFarki = (cikis - giris) / (1000 * 60 * 60);
            toplamSaat += saatFarki;
          }
        });

        const hesaplananMaas = toplamSaat * maas.saat_bazli_maas;
        const fark = hesaplananMaas - maas.aylik_maas;

        raporData.push({
          kullanici_id: maas.kullanici_id,
          isim: maas.personel?.isim || '',
          soyisim: maas.personel?.soyisim || '',
          aylik_maas: maas.aylik_maas,
          hedef_saat: maas.hedef_saat,
          calisilan_saat: toplamSaat,
          saatlik_ucret: maas.saat_bazli_maas,
          hesaplanan_maas: hesaplananMaas,
          fark: fark
        });
      }

      // Alfabetik sıralama (Ad Soyad'a göre)
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
        .select('kullanici_id, isim, soyisim')
        .eq('aktif', true)
        .order('isim');

      if (error) throw error;
      setAvailablePersonel(data || []);
    } catch (error) {
      console.error('Personel yükleme hatası:', error);
    }
  };

  const addNewSalary = async () => {
    if (!selectedPersonel || !addSalary || !addTargetHours) {
      alert('Lütfen tüm alanları doldurun');
      return;
    }

    // Duplicate kontrolü
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
          hedef_saat: parseInt(addTargetHours),
          aktif: true
        });

      if (error) throw error;

      alert('Maaş ayarı başarıyla eklendi');
      setShowAddForm(false);
      setSelectedPersonel('');
      setAddSalary('');
      setAddTargetHours('');
      fetchMaasAyarlari();
    } catch (error) {
      console.error('Maaş ekleme hatası:', error);
      alert('Maaş eklenirken hata oluştu: ' + error.message);
    }
  };

  const updateSalary = async (kullaniciId) => {
    if (!newSalary || !newTargetHours) {
      alert('Lütfen tüm alanları doldurun');
      return;
    }

    try {
      const { error } = await supabase
        .from('maas_ayarlari')
        .update({
          aylik_maas: parseFloat(newSalary),
          hedef_saat: parseInt(newTargetHours)
        })
        .eq('kullanici_id', kullaniciId);

      if (error) throw error;

      alert('Maaş ayarı başarıyla güncellendi');
      setEditingSalary(null);
      setNewSalary('');
      setNewTargetHours('');
      fetchMaasAyarlari();
    } catch (error) {
      console.error('Maaş güncelleme hatası:', error);
      alert('Maaş güncellenirken hata oluştu: ' + error.message);
    }
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
    const printContent = document.getElementById('maas-raporu-tablosu');
    if (printContent) {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Maaş Raporu - ${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}</title>
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
            <h2>Maaş Raporu - ${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}</h2>
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
        <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #ddd' }}>
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
          {/* Ay/Yıl Seçimi */}
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
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
              Maaş Raporu - {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </h3>
            {loading ? (
              <p>Yükleniyor...</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table id="maas-raporu-tablosu" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5' }}>
                      <th style={{ border: '1px solid #ddd', padding: '8px' }}>Kullanıcı ID</th>
                      <th style={{ border: '1px solid #ddd', padding: '8px' }}>Ad Soyad</th>
                      <th style={{ border: '1px solid #ddd', padding: '8px' }}>Aylık Maaş</th>
                      <th style={{ border: '1px solid #ddd', padding: '8px' }}>Hedef Saat</th>
                      <th style={{ border: '1px solid #ddd', padding: '8px' }}>Çalışılan Saat</th>
                      <th style={{ border: '1px solid #ddd', padding: '8px' }}>Saatlik Ücret</th>
                      <th style={{ border: '1px solid #ddd', padding: '8px' }}>Hesaplanan Maaş</th>
                      <th style={{ border: '1px solid #ddd', padding: '8px' }}>Fark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maasRaporu.map((rapor) => (
                      <tr key={rapor.kullanici_id}>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{rapor.kullanici_id}</td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                          {rapor.isim} {rapor.soyisim}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                          {formatCurrency(rapor.aylik_maas)}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                          {rapor.hedef_saat} saat
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                          {formatHours(rapor.calisilan_saat)}
                        </td>
                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                          {formatCurrency(rapor.saatlik_ucret)}
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
          {/* Maaş Ayarları */}
          <div style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3>Maaş Ayarları</h3>
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
                <h4>Yeni Maaş Ayarı Ekle</h4>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <label>Personel:</label>
                    <select
                      value={selectedPersonel}
                      onChange={(e) => setSelectedPersonel(e.target.value)}
                      style={{ marginLeft: '5px', padding: '5px', minWidth: '200px' }}
                    >
                      <option value="">Personel Seçin</option>
                      {availablePersonel
                        .filter(p => !maasAyarlari.some(ma => ma.kullanici_id === p.kullanici_id))
                        .map(personel => (
                          <option key={personel.kullanici_id} value={personel.kullanici_id}>
                            {personel.kullanici_id} - {personel.isim} {personel.soyisim}
                          </option>
                        ))
                      }
                      {availablePersonel.filter(p => !maasAyarlari.some(ma => ma.kullanici_id === p.kullanici_id)).length === 0 && (
                        <option value="" disabled>Tüm personel için maaş ayarı mevcut</option>
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
                  
                  <div>
                    <label>Hedef Saat:</label>
                    <input
                      type="number"
                      value={addTargetHours}
                      onChange={(e) => setAddTargetHours(e.target.value)}
                      placeholder="240"
                      style={{ marginLeft: '5px', padding: '5px', width: '100px' }}
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
                        setAddTargetHours('');
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
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>Kullanıcı ID</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>Ad Soyad</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>Aylık Maaş</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>Hedef Saat</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>Saatlik Ücret</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {maasAyarlari.map((ayar) => (
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
                        {editingSalary === ayar.kullanici_id ? (
                          <input
                            type="number"
                            value={newTargetHours}
                            onChange={(e) => setNewTargetHours(e.target.value)}
                            placeholder="Hedef saat"
                            style={{ width: '80px', padding: '4px' }}
                          />
                        ) : (
                          `${ayar.hedef_saat} saat`
                        )}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {formatCurrency(ayar.saat_bazli_maas)}
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
                                setNewTargetHours('');
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
                              setNewTargetHours(ayar.hedef_saat.toString());
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
                  ))}
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