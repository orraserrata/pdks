import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import PersonelListesi from './PersonelListesi';

function App() {
  const [personeller, setPersoneller] = useState([])

  useEffect(() => {
    fetchPersoneller()
  }, [])

  const fetchPersoneller = async () => {
    const { data, error } = await supabase
      .from('personel')
      .select('*')
      .order('isim', { ascending: true })

    if (error) {
      console.error('Hata:', error)
    } else {
      setPersoneller(data)
    }
  }

  return (
    <div>
      <h1>Personel Listesi</h1>
      <ul>
        {personeller.map((p) => (
          <li key={p.id}>
            {p.isim} {p.soyisim}
          </li>
        ))}
      </ul>
    </div>
  )
}
function App() {
  return (
    <div className="App">
      <PersonelListesi />
    </div>
  );
}

export default App
