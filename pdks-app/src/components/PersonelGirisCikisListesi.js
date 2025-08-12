// src/components/PersonelGirisCikisListesi.js
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function PersonelGirisCikisListesi() {
  const [kayitlar, setKayitlar] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('personel_giris_cikis')
        .select('*')
        .order('giris_tarihi', { ascending: false });

      if (error) {
        console.error('Veri çekme hatası:', error);
      } else {
        setKayitlar(data);
      }
      setLoading(false);
    }

    fetchData();
  }, []);

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <div>
      <h2>Personel Giriş-Çıkış Kayıtları</h2>
      <ul>
        {kayitlar.map(kayit => (
          <li key={kayit.id}>
            Kullanıcı ID: {kayit.kullanici_id} - Giriş Tarihi: {kayit.giris_tarihi}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PersonelGirisCikisListesi;
