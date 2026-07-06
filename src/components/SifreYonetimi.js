import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const SifreYonetimi = () => {
  const [selectedUser, setSelectedUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const handlePasswordReset = async () => {
    if (!selectedUser) {
      setMessage('Lütfen kullanıcı e-posta adresini girin');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    setMessageType('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(selectedUser, {
        redirectTo: window.location.origin,
      });

      if (error) throw error;

      setMessage('Şifre sıfırlama e-postası başarıyla gönderildi.');
      setMessageType('success');
      setSelectedUser('');
    } catch (error) {
      console.error('Şifre sıfırlama hatası:', error);
      setMessage('Şifre sıfırlama e-postası gönderilirken hata oluştu: ' + error.message);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-section">
      <h3 className="admin-section-title">Şifre Yönetimi</h3>
      <div className="personel-add-card">
        <div className="personel-form-grid personel-form-grid--add">
          <div className="personel-form-field personel-form-field--span-full-mobile">
            <label htmlFor="sifre-reset-email">Kullanıcı E-posta</label>
            <input
              id="sifre-reset-email"
              type="email"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              placeholder="kullanici@email.com"
            />
          </div>
        </div>
        <div className="personel-add-footer">
          <div />
          <button
            type="button"
            className="maas-btn maas-btn--danger"
            onClick={handlePasswordReset}
            disabled={loading}
          >
            {loading ? 'Gönderiliyor...' : 'Şifre Sıfırlama E-postası Gönder'}
          </button>
        </div>
        {message && (
          <div className={messageType === 'success' ? 'admin-message admin-message--success' : 'personel-error'}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default SifreYonetimi;
