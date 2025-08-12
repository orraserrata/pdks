import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

function PersonelListesi() {
  const [personeller, setPersoneller] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPersoneller() {
      const { data, error } = await supabase
        .from('personel')
        .select('*');
      if (error) {
        console.error('Veri çekme hatası:', error);
      } else {
        setPersoneller(data);
      }
      setLoading(false);
    }
    fetchPersoneller();
  }, []);

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <div>
      <h2>Personel Listesi</h2>
      <ul>
        {personeller.map(p => (
          <li key={p.kullanici_id}>{p.isim} {p.soyisim}</li>
        ))}
      </ul>
    </div>
  );
}

export default PersonelListesi;
