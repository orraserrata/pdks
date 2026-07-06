import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import Modal from './Modal';
import {
  fetchMaasHedefleri,
  saveMaasHedef,
  calcBirimUcret,
  getHedefDeger,
  DEFAULT_HEDEFLER,
} from '../utils/maasHedefleri';
import LoadingSpinner from './LoadingSpinner';

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
  const [detailRapor, setDetailRapor] = useState(null);
  const [detailAyar, setDetailAyar] = useState(null);

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
    if (maasAyarlari.length === 0) return;
    fetchMaasRaporu();
  }, [selectedMonth, selectedYear, hedefAyarlari, maasAyarlari]);

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

      const maasData = maasAyarlari;
      if (!maasData.length) return;

      const monthStart = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
      let endYear = selectedYear;
      let endMonth = selectedMonth + 1;
      if (endMonth > 12) {
        endMonth = 1;
        endYear += 1;
      }
      const monthEnd = `${endYear}-${endMonth.toString().padStart(2, '0')}-01`;

      const { data: tumKayitlar, error: calismaError } = await supabase
        .from('personel_giris_cikis_duzenli')
        .select('kullanici_id, giris_tarihi, cikis_tarihi, workday_date')
        .gte('giris_tarihi', monthStart)
        .lt('giris_tarihi', monthEnd);

      if (calismaError) throw calismaError;

      const kayitlarByUser = {};
      (tumKayitlar || []).forEach((record) => {
        if (!kayitlarByUser[record.kullanici_id]) {
          kayitlarByUser[record.kullanici_id] = [];
        }
        kayitlarByUser[record.kullanici_id].push(record);
      });

      const raporData = [];

      for (const maas of maasData) {
        const maasTipi = getPersonelMaasTipi(maas.personel);
        const calismaData = kayitlarByUser[maas.kullanici_id] || [];

        if (maasTipi === 'gunluk') {
          const gunler = new Set();
          calismaData.forEach((record) => {
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
          calismaData.forEach((record) => {
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
      setDetailAyar(null);
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

  const getDisplayName = (isim, soyisim) => `${isim || ''} ${soyisim || ''}`.trim() || 'Personel';

  const handlePrint = () => {
    const raporBaslik = isReportGunluk ? 'Gün Bazlı Maaş Raporu' : 'Saatlik Maaş Raporu';
    const monthLabel = months.find(m => m.value === selectedMonth)?.label;
    const rows = filteredMaasRaporu.map((rapor) => `
      <tr>
        <td>${rapor.kullanici_id}</td>
        <td>${getDisplayName(rapor.isim, rapor.soyisim)}</td>
        <td>${formatCurrency(rapor.aylik_maas)}</td>
        <td>${formatHedef(rapor)}</td>
        <td>${formatCalisilan(rapor)}</td>
        <td>${formatCurrency(rapor.birim_ucret)}</td>
        <td>${formatCurrency(rapor.hesaplanan_maas)}</td>
        <td class="${rapor.fark >= 0 ? 'positive' : 'negative'}">${rapor.fark >= 0 ? '+' : ''}${formatCurrency(rapor.fark)}</td>
      </tr>
    `).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${raporBaslik} - ${monthLabel} ${selectedYear}</title>
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
          <h2>${raporBaslik} - ${monthLabel} ${selectedYear}</h2>
          <table>
            <thead>
              <tr>
                <th>Kullanıcı ID</th>
                <th>Ad Soyad</th>
                <th>Aylık Maaş</th>
                <th>${isReportGunluk ? 'Hedef Gün' : 'Hedef Saat'}</th>
                <th>${isReportGunluk ? 'Çalışılan Gün' : 'Çalışılan Saat'}</th>
                <th>${isReportGunluk ? 'Günlük Ücret' : 'Saatlik Ücret'}</th>
                <th>Hesaplanan Maaş</th>
                <th>Fark</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const renderMaasTypeTabs = (activeTip, onChange, countFn) => (
    <div className="maas-type-tabs">
      {MAAS_TIPI_TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={`maas-type-tab maas-type-tab--${tab.value}${activeTip === tab.value ? ' maas-type-tab--active' : ''}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          <span className="maas-type-tab-count">({countFn(tab.value)})</span>
        </button>
      ))}
    </div>
  );

  const renderRaporDetail = (rapor) => (
    <div className="personel-detail-dialog">
      <div className="personel-detail-grid">
        <div className="personel-detail-item">
          <span className="personel-detail-label">Kullanıcı ID</span>
          <span className="personel-detail-value">{rapor.kullanici_id}</span>
        </div>
        <div className="personel-detail-item">
          <span className="personel-detail-label">Aylık Maaş</span>
          <span className="personel-detail-value">{formatCurrency(rapor.aylik_maas)}</span>
        </div>
        <div className="personel-detail-item">
          <span className="personel-detail-label">{rapor.maas_tipi === 'gunluk' ? 'Hedef Gün' : 'Hedef Saat'}</span>
          <span className="personel-detail-value">{formatHedef(rapor)}</span>
        </div>
        <div className="personel-detail-item">
          <span className="personel-detail-label">{rapor.maas_tipi === 'gunluk' ? 'Çalışılan Gün' : 'Çalışılan Saat'}</span>
          <span className="personel-detail-value">{formatCalisilan(rapor)}</span>
        </div>
        <div className="personel-detail-item">
          <span className="personel-detail-label">{rapor.maas_tipi === 'gunluk' ? 'Günlük Ücret' : 'Saatlik Ücret'}</span>
          <span className="personel-detail-value">{formatCurrency(rapor.birim_ucret)}</span>
        </div>
        <div className="personel-detail-item">
          <span className="personel-detail-label">Hesaplanan Maaş</span>
          <span className="personel-detail-value">{formatCurrency(rapor.hesaplanan_maas)}</span>
        </div>
        <div className="personel-detail-item personel-detail-item--full">
          <span className="personel-detail-label">Fark</span>
          <span className={`personel-detail-value${rapor.fark >= 0 ? ' maas-fark-positive' : ' maas-fark-negative'}`}>
            {rapor.fark >= 0 ? '+' : ''}{formatCurrency(rapor.fark)}
          </span>
        </div>
      </div>
    </div>
  );

  const renderAyarDetail = (ayar) => {
    const tip = getPersonelMaasTipi(ayar.personel);
    const birimUcret = calcBirimUcret(ayar.aylik_maas, tip, hedefAyarlari);
    const isEditing = editingSalary === ayar.kullanici_id;

    return (
      <div className="personel-detail-dialog">
        <div className="personel-detail-grid">
          <div className="personel-detail-item">
            <span className="personel-detail-label">Kullanıcı ID</span>
            <span className="personel-detail-value">{ayar.kullanici_id}</span>
          </div>
          <div className="personel-detail-item">
            <span className="personel-detail-label">Maaş Tipi</span>
            <span className="personel-detail-value">{tip === 'gunluk' ? 'Gün Bazlı' : 'Saatlik'}</span>
          </div>
          <div className="personel-detail-item personel-detail-item--full">
            <span className="personel-detail-label">Aylık Maaş</span>
            {isEditing ? (
              <input
                type="number"
                value={newSalary}
                onChange={(e) => setNewSalary(e.target.value)}
                className="maas-dialog-input"
                placeholder="Aylık maaş"
              />
            ) : (
              <span className="personel-detail-value">{formatCurrency(ayar.aylik_maas)}</span>
            )}
          </div>
          <div className="personel-detail-item">
            <span className="personel-detail-label">{tip === 'gunluk' ? 'Günlük Ücret' : 'Saatlik Ücret'}</span>
            <span className="personel-detail-value">{formatCurrency(birimUcret)}</span>
          </div>
          <div className="personel-detail-item">
            <span className="personel-detail-label">Hedef</span>
            <span className="personel-detail-value">
              {getHedefDeger(tip, hedefAyarlari)} {tip === 'gunluk' ? 'gün' : 'saat'}
            </span>
          </div>
        </div>
        <div className="personel-detail-actions">
          {isEditing ? (
            <>
              <button type="button" className="btn-primary" onClick={() => updateSalary(ayar.kullanici_id)}>
                Kaydet
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditingSalary(null);
                  setNewSalary('');
                }}
              >
                İptal
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setEditingSalary(ayar.kullanici_id);
                setNewSalary(ayar.aylik_maas.toString());
              }}
            >
              Düzenle
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2>Maaş Hesabı</h2>

      <div className="maas-sub-tabs">
        <button
          type="button"
          className={`maas-sub-tab${activeSubTab === 'raporlar' ? ' maas-sub-tab--active' : ''}`}
          onClick={() => setActiveSubTab('raporlar')}
        >
          Maaş Raporları
        </button>
        <button
          type="button"
          className={`maas-sub-tab${activeSubTab === 'ayarlar' ? ' maas-sub-tab--active' : ''}`}
          onClick={() => setActiveSubTab('ayarlar')}
        >
          Maaş Ayarları
        </button>
      </div>

      {activeSubTab === 'raporlar' && (
        <div>
          {renderMaasTypeTabs(reportMaasTipi, setReportMaasTipi, (tip) =>
            maasRaporu.filter((r) => r.maas_tipi === tip).length
          )}

          <div className="maas-toolbar">
            <div className="maas-toolbar-field">
              <label htmlFor="maas-rapor-ay">Ay</label>
              <select
                id="maas-rapor-ay"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              >
                {months.map((month) => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </div>
            <div className="maas-toolbar-field">
              <label htmlFor="maas-rapor-yil">Yıl</label>
              <select
                id="maas-rapor-yil"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              >
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <button type="button" className="maas-btn maas-btn--primary" onClick={fetchMaasRaporu}>
              Yenile
            </button>
            <button type="button" className="maas-btn maas-btn--success" onClick={handlePrint}>
              Yazdır
            </button>
          </div>

          <h3 className="maas-section-title">
            {isReportGunluk ? 'Gün Bazlı Maaş Raporu' : 'Saatlik Maaş Raporu'}
            {' — '}{months.find((m) => m.value === selectedMonth)?.label} {selectedYear}
          </h3>

          {loading ? (
            <LoadingSpinner />
          ) : filteredMaasRaporu.length === 0 ? (
            <div className="personel-empty">Bu kategoride rapor verisi bulunmuyor.</div>
          ) : (
            <div className="personel-mobile-list">
              {filteredMaasRaporu.map((rapor) => (
                <button
                  key={rapor.kullanici_id}
                  type="button"
                  className="personel-collapsed-card personel-collapsed-card--name-only"
                  onClick={() => setDetailRapor(rapor)}
                >
                  <div className="personel-collapsed-card-name">
                    {getDisplayName(rapor.isim, rapor.soyisim)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'ayarlar' && (
        <div>
          <div className="maas-hedef-card">
            <h3 className="maas-hedef-title">Genel Hedef Ayarları</h3>
            <div className="maas-hedef-grid">
              <div className="maas-toolbar-field">
                <label htmlFor="hedef-saatli">Hedef Saat (Saatlik)</label>
                <input
                  id="hedef-saatli"
                  type="number"
                  value={hedefInputs.saatli}
                  onChange={(e) => setHedefInputs((prev) => ({ ...prev, saatli: e.target.value }))}
                  className="maas-dialog-input"
                />
              </div>
              <div className="maas-toolbar-field">
                <label htmlFor="hedef-gunluk">Hedef Gün (Günlük)</label>
                <input
                  id="hedef-gunluk"
                  type="number"
                  value={hedefInputs.gunluk}
                  onChange={(e) => setHedefInputs((prev) => ({ ...prev, gunluk: e.target.value }))}
                  className="maas-dialog-input"
                />
              </div>
              <button
                type="button"
                className="maas-btn maas-btn--primary"
                onClick={handleSaveHedefAyarlari}
                disabled={hedefSaving}
              >
                {hedefSaving ? 'Kaydediliyor...' : 'Hedefleri Kaydet'}
              </button>
            </div>
          </div>

          {renderMaasTypeTabs(settingsMaasTipi, (tip) => {
            setSettingsMaasTipi(tip);
            setShowAddForm(false);
            setEditingSalary(null);
            setSelectedPersonel('');
            setAddSalary('');
            setDetailAyar(null);
          }, (tip) => maasAyarlari.filter((a) => getPersonelMaasTipi(a.personel) === tip).length)}

          <div className="maas-section-header">
            <h3 className="maas-section-title" style={{ margin: 0 }}>
              {isGunluk ? 'Gün Bazlı Maaş Ayarları' : 'Saatlik Maaş Ayarları'}
            </h3>
            <button
              type="button"
              className="maas-btn maas-btn--success"
              onClick={() => setShowAddForm(true)}
            >
              + Yeni Maaş Ayarı Ekle
            </button>
          </div>

          {showAddForm && (
            <div className="personel-add-card">
              <h4 className="personel-add-title">
                Yeni {isGunluk ? 'Gün Bazlı' : 'Saatlik'} Maaş Ayarı Ekle
              </h4>
              <div className="personel-form-grid personel-form-grid--add">
                <div className="personel-form-field personel-form-field--span-full-mobile">
                  <label htmlFor="maas-add-personel">Personel</label>
                  <select
                    id="maas-add-personel"
                    value={selectedPersonel}
                    onChange={(e) => setSelectedPersonel(e.target.value)}
                  >
                    <option value="">Personel Seçin</option>
                    {filteredAvailablePersonel.map((personel) => (
                      <option key={personel.kullanici_id} value={personel.kullanici_id}>
                        {personel.kullanici_id} - {getDisplayName(personel.isim, personel.soyisim)}
                      </option>
                    ))}
                    {filteredAvailablePersonel.length === 0 && (
                      <option value="" disabled>Bu kategoride eklenecek personel yok</option>
                    )}
                  </select>
                </div>
                <div className="personel-form-field">
                  <label htmlFor="maas-add-salary">Aylık Maaş</label>
                  <input
                    id="maas-add-salary"
                    type="number"
                    value={addSalary}
                    onChange={(e) => setAddSalary(e.target.value)}
                    placeholder="40000"
                  />
                </div>
              </div>
              <div className="personel-add-footer">
                <div />
                <div className="personel-form-actions" style={{ flexDirection: 'row', width: 'auto' }}>
                  <button type="button" className="btn-primary" onClick={addNewSalary}>Ekle</button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setShowAddForm(false);
                      setSelectedPersonel('');
                      setAddSalary('');
                    }}
                  >
                    İptal
                  </button>
                </div>
              </div>
            </div>
          )}

          {filteredMaasAyarlari.length === 0 ? (
            <div className="personel-empty">Bu kategoride aktif personel bulunmuyor.</div>
          ) : (
            <div className="personel-mobile-list">
              {filteredMaasAyarlari.map((ayar) => (
                <button
                  key={ayar.kullanici_id}
                  type="button"
                  className="personel-collapsed-card personel-collapsed-card--name-only"
                  onClick={() => {
                    setDetailAyar(ayar);
                    setEditingSalary(null);
                    setNewSalary('');
                  }}
                >
                  <div className="personel-collapsed-card-name">
                    {getDisplayName(ayar.personel?.isim, ayar.personel?.soyisim)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        open={!!detailRapor}
        onClose={() => setDetailRapor(null)}
        title={detailRapor ? getDisplayName(detailRapor.isim, detailRapor.soyisim) : 'Maaş Raporu Detayı'}
      >
        {detailRapor && renderRaporDetail(detailRapor)}
      </Modal>

      <Modal
        open={!!detailAyar}
        onClose={() => {
          setDetailAyar(null);
          setEditingSalary(null);
          setNewSalary('');
        }}
        title={detailAyar ? getDisplayName(detailAyar.personel?.isim, detailAyar.personel?.soyisim) : 'Maaş Ayarı'}
      >
        {detailAyar && renderAyarDetail(detailAyar)}
      </Modal>
    </div>
  );
};

export default MaasHesabi;