import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import CalisanListesi from "./components/CalisanListesi";
import CalisanDetay from "./components/CalisanDetay";

function App() {
  const [personeller, setPersoneller] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seciliCalisan, setSeciliCalisan] = useState(null);

  useEffect(() => {
    async function fetchPersoneller() {
      const { data, error } = await supabase
        .from('personel_giris_cikis_duzenli')
        .select('kullanici_id')
        .order('kullanici_id', { ascending: true });
		

      if (error) {
        console.error('Veri çekme hatası:', error);
        setPersoneller([]);
      } else {
        setPersoneller(data || []);
      }
      setLoading(false);
    }

    fetchPersoneller();
  }, []);

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <div className="App">
      <h1>PDKS Uygulaması</h1>

      <div style={{ display: 'flex', gap: '50px', alignItems: 'flex-start' }}>
        {/* Çalışan listesi */}
        <CalisanListesi
          personeller={personeller}
          onCalisanSelect={(calisan) => setSeciliCalisan(calisan)}
        />

        {/* Seçilen çalışanın detayları */}
        {seciliCalisan && <CalisanDetay calisan={seciliCalisan} />}
      </div>
    </div>
  );
}

export default App;
