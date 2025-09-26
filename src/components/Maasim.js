import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const Maasim = ({ session, userProfile }) => {
  const [maasBilgileri, setMaasBilgileri] = useState(null);
  const [calismaSaatleri, setCalismaSaatleri] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [error, setError] = useState('');

  // Ay ve yıl seçenekleri
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
    if (session && userProfile) {
      fetchMaasBilgileri();
      fetchCalismaSaatleri();
    }
  }, [session, userProfile, selectedMonth, selectedYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMaasBilgileri = async () => {
    try {
      if (!userProfile?.kullanici_id) {
        setError('Kullanıcı ID bulunamadı');
        return;
      }

      const { data, error } = await supabase
        .from('maas_ayarlari')
        .select('*')
        .eq('kullanici_id', userProfile.kullanici_id)
        .eq('aktif', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      setMaasBilgileri(data);
    } catch (error) {
      console.error('Maaş bilgileri yükleme hatası:', error);
      setError('Maaş bilgileri yüklenirken hata oluştu');
    }
  };

  const fetchCalismaSaatleri = async () => {
    try {
      if (!userProfile?.kullanici_id) {
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from('personel_giris_cikis_duzenli')
        .select('*')
        .eq('kullanici_id', userProfile.kullanici_id)
        .gte('giris_tarihi', `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`)
        .lt('giris_tarihi', `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-01`)
        .order('giris_tarihi', { ascending: true });

      if (error) throw error;

      setCalismaSaatleri(data || []);
    } catch (error) {
      console.error('Çalışma saatleri yükleme hatası:', error);
      setError('Çalışma saatleri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  };

  const formatHours = (hours) => {
    return `${Math.floor(hours)}:${Math.round((hours % 1) * 60).toString().padStart(2, '0')}`;
  };

  const calculateTotalHours = () => {
    let totalHours = 0;
    calismaSaatleri.forEach(record => {
      if (record.cikis_tarihi) {
        const giris = new Date(record.giris_tarihi);
        const cikis = new Date(record.cikis_tarihi);
        const saatFarki = (cikis - giris) / (1000 * 60 * 60);
        totalHours += saatFarki;
      }
    });
    return totalHours;
  };

  const calculateEarnedSalary = () => {
    if (!maasBilgileri) return 0;
    const totalHours = calculateTotalHours();
    return totalHours * maasBilgileri.saat_bazli_maas;
  };

  if (!session) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h3>Giriş Gerekli</h3>
        <p>Maaş bilgilerinizi görmek için giriş yapmanız gerekiyor.</p>
      </div>
    );
  }

  if (loading) {
    return <div>Maaş bilgileri yükleniyor...</div>;
  }

  if (error) {
    return (
      <div style={{ color: 'red', textAlign: 'center', padding: '20px' }}>
        {error}
      </div>
    );
  }

  if (!maasBilgileri) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h3>Maaş Bilgisi Bulunamadı</h3>
        <p>Henüz maaş ayarlarınız yapılmamış. Lütfen yöneticinizle iletişime geçin.</p>
      </div>
    );
  }

  const totalHours = calculateTotalHours();
  const earnedSalary = calculateEarnedSalary();
  const salaryDifference = earnedSalary - maasBilgileri.aylik_maas;

  return (
    <div>
      <h2>Maaşım</h2>
      
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
          onClick={fetchCalismaSaatleri}
          style={{ padding: '5px 10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Yenile
        </button>
      </div>

      {/* Maaş Özeti */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '20px', 
        marginBottom: '30px' 
      }}>
        <div style={{ 
          border: '1px solid #ddd', 
          padding: '20px', 
          borderRadius: '8px',
          backgroundColor: '#f8f9fa'
        }}>
          <h4>Aylık Maaş</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
            {formatCurrency(maasBilgileri.aylik_maas)}
          </p>
        </div>


        <div style={{ 
          border: '1px solid #ddd', 
          padding: '20px', 
          borderRadius: '8px',
          backgroundColor: '#f8f9fa'
        }}>
          <h4>Saatlik Ücret</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#6f42c1' }}>
            {formatCurrency(maasBilgileri.saat_bazli_maas)}
          </p>
        </div>

        <div style={{ 
          border: '1px solid #ddd', 
          padding: '20px', 
          borderRadius: '8px',
          backgroundColor: '#f8f9fa'
        }}>
          <h4>Çalışılan Saat</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#fd7e14' }}>
            {formatHours(totalHours)}
          </p>
        </div>

        <div style={{ 
          border: '1px solid #ddd', 
          padding: '20px', 
          borderRadius: '8px',
          backgroundColor: '#f8f9fa'
        }}>
          <h4>Hesaplanan Maaş</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#20c997' }}>
            {formatCurrency(earnedSalary)}
          </p>
        </div>

        <div style={{ 
          border: '1px solid #ddd', 
          padding: '20px', 
          borderRadius: '8px',
          backgroundColor: '#f8f9fa'
        }}>
          <h4>Fark</h4>
          <p style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            color: salaryDifference >= 0 ? '#28a745' : '#dc3545'
          }}>
            {salaryDifference >= 0 ? '+' : ''}{formatCurrency(salaryDifference)}
          </p>
        </div>
      </div>

      {/* Çalışma Detayları */}
      <div>
        <h3>
          Çalışma Detayları - {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
        </h3>
        
        <div style={{ 
          marginBottom: '15px', 
          padding: '10px', 
          backgroundColor: '#e7f3ff', 
          border: '1px solid #b3d9ff', 
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          <strong>Bilgi:</strong> Sarı renkli satırlar admin tarafından düzeltilmiş kayıtlardır. 
          Bu kayıtlar maaş hesaplamasına dahil edilir.
        </div>
        
        {calismaSaatleri.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>Tarih</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>Giriş</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>Çıkış</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>Çalışılan Saat</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>Kazanç</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px' }}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {calismaSaatleri.map((record, index) => {
                  const giris = new Date(record.giris_tarihi);
                  const cikis = record.cikis_tarihi ? new Date(record.cikis_tarihi) : null;
                  const calisilanSaat = cikis ? (cikis - giris) / (1000 * 60 * 60) : 0;
                  const kazanc = calisilanSaat * maasBilgileri.saat_bazli_maas;
                  const isAdminLocked = record.admin_locked;

                  return (
                    <tr 
                      key={index}
                      style={{ 
                        backgroundColor: isAdminLocked ? '#fff3cd' : 'white',
                        border: isAdminLocked ? '2px solid #ffc107' : '1px solid #ddd'
                      }}
                    >
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {giris.toLocaleDateString('tr-TR')}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {giris.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {cikis ? cikis.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : 'Çıkış yapılmamış'}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {formatHours(calisilanSaat)}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {formatCurrency(kazanc)}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {isAdminLocked ? (
                          <span style={{ 
                            color: '#856404', 
                            fontWeight: 'bold',
                            backgroundColor: '#ffc107',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}>
                            Düzeltilmiş
                          </span>
                        ) : (
                          <span style={{ 
                            color: '#155724', 
                            fontWeight: 'bold',
                            backgroundColor: '#d4edda',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}>
                            Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#6c757d' }}>
            Bu ay için çalışma kaydı bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
};

export default Maasim;
