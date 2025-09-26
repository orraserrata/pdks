import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const SifreYonetimi = () => {
  const [selectedUser, setSelectedUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handlePasswordReset = async () => {
    if (!selectedUser) {
      setMessage('Lütfen kullanıcı email adresini girin');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // Şifre sıfırlama emaili gönder
      const { error } = await supabase.auth.resetPasswordForEmail(selectedUser, {
        redirectTo: window.location.origin + '/reset-password'
      });

      if (error) throw error;

      setMessage('Şifre sıfırlama emaili başarıyla gönderildi. Kullanıcı email adresini kontrol etsin.');
      setSelectedUser('');
    } catch (error) {
      console.error('Şifre sıfırlama hatası:', error);
      setMessage('Şifre sıfırlama emaili gönderilirken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h3>Şifre Yönetimi</h3>
      
      <div style={{ marginBottom: '20px' }}>
        <label>
          Kullanıcı Email:
          <input
            type="email"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            placeholder="kullanici@email.com"
            style={{ marginLeft: '10px', padding: '8px', width: '300px' }}
          />
        </label>
      </div>

      <button
        onClick={handlePasswordReset}
        disabled={loading}
        style={{
          padding: '10px 20px',
          backgroundColor: loading ? '#6c757d' : '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Gönderiliyor...' : 'Şifre Sıfırlama Emaili Gönder'}
      </button>

      {message && (
        <div style={{
          marginTop: '15px',
          padding: '10px',
          backgroundColor: message.includes('başarıyla') ? '#d4edda' : '#f8d7da',
          color: message.includes('başarıyla') ? '#155724' : '#721c24',
          border: `1px solid ${message.includes('başarıyla') ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px'
        }}>
          {message}
        </div>
      )}

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
        <h4>Nasıl Çalışır:</h4>
        <p>• Kullanıcının email adresini girin</p>
        <p>• "Şifre Sıfırlama Emaili Gönder" butonuna tıklayın</p>
        <p>• Kullanıcıya şifre sıfırlama emaili gönderilir</p>
        <p>• Kullanıcı emailindeki linke tıklayarak yeni şifre belirler</p>
        <p>• Bu yöntem güvenli ve kullanıcı dostudur</p>
      </div>
    </div>
  );
};

export default SifreYonetimi;
