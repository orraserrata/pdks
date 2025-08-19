import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function HesapOlustur({ onSuccess }) {
  const [formData, setFormData] = useState({
    kullanici_id: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Önce kullanici_id'nin personel tablosunda var olup olmadığını kontrol et
      const { data: personelData, error: personelError } = await supabase
        .from('personel')
        .select('kullanici_id, isim, soyisim')
        .eq('kullanici_id', parseInt(formData.kullanici_id))
        .single();

      if (personelError || !personelData) {
        setError('Bu kullanıcı ID\'si sistemde kayıtlı değil!');
        setLoading(false);
        return;
      }

      // Supabase Auth ile hesap oluştur
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            kullanici_id: parseInt(formData.kullanici_id),
            isim: personelData.isim,
            soyisim: personelData.soyisim
          }
        }
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // Kullanıcı profilini kullanici_profilleri tablosuna ekle
      const { error: profileError } = await supabase
        .from('kullanici_profilleri')
        .insert({
          kullanici_id: parseInt(formData.kullanici_id),
          email: formData.email,
          isim: personelData.isim,
          soyisim: personelData.soyisim,
          is_admin: false // Yeni hesaplar varsayılan olarak admin değil
        });

      if (profileError) {
        setError('Profil oluşturulurken hata: ' + profileError.message);
        setLoading(false);
        return;
      }

      setSuccess('Hesap başarıyla oluşturuldu! Şimdi giriş yapabilirsiniz.');
      setFormData({
        kullanici_id: '',
        email: '',
        password: ''
      });

      // 2 saniye sonra modal'ı kapat
      setTimeout(() => {
        onSuccess();
      }, 2000);

    } catch (err) {
      setError('Beklenmeyen bir hata oluştu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '20px', color: '#333' }}>Yeni Hesap Oluştur</h2>
      
      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#fee2e2',
          border: '1px solid #ef4444',
          borderRadius: '6px',
          marginBottom: '15px',
          color: '#991b1b'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '10px',
          backgroundColor: '#dcfce7',
          border: '1px solid #10b981',
          borderRadius: '6px',
          marginBottom: '15px',
          color: '#166534'
        }}>
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
            Kullanıcı ID: *
          </label>
          <input
            type="number"
            name="kullanici_id"
            value={formData.kullanici_id}
            onChange={handleChange}
            required
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            placeholder="Sistemde kayıtlı kullanıcı ID'nizi girin"
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
            E-posta: *
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            placeholder="E-posta adresinizi girin"
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
            Şifre: *
          </label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength="6"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            placeholder="En az 6 karakter"
          />
        </div>



        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: loading ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          {loading ? 'Hesap Oluşturuluyor...' : 'Hesap Oluştur'}
        </button>
      </form>

              <div style={{ 
          marginTop: '15px', 
          padding: '10px', 
          backgroundColor: '#f3f4f6', 
          borderRadius: '6px',
          fontSize: '13px',
          color: '#6b7280'
        }}>
          <strong>Not:</strong> Hesap oluşturmak için sistemde kayıtlı bir kullanıcı ID'sine sahip olmanız gerekmektedir. Ad ve soyad bilgileri otomatik olarak personel kaydınızdan alınacaktır.
        </div>
    </div>
  );
}
