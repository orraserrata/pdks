import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

function PersonelListesi({ personeller }) {
  if (!personeller.length) return <div>Personel bulunamadı.</div>;

  return (
    <div>
      <h2>Personel Listesi</h2>
      <ul>
        {personeller.map((p) => (
          <li key={p.id}>
            {p.isim} {p.soyisim}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PersonelListesi;

