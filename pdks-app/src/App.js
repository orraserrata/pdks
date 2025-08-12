import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import PersonelListesi from './PersonelListesi';
import PersonelGirisCikisListesi from './components/PersonelGirisCikisListesi';

function App() {
  const [personeller, setPersoneller] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPersoneller() {
      const { data, error } = await supabase
        .from('personel')
        .select('*')
        .order('isim', { ascending: true });

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
      <PersonelListesi personeller={personeller} />
      <PersonelGirisCikisListesi />
    </div>
  );
}

export default App;
