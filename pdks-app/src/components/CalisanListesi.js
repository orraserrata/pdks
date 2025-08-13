// components/CalisanListesi.js
import React from "react";
import { supabase } from "../supabaseClient";

export default function CalisanListesi({ personeller, setSeciliCalisan }) {
  return (
    <div>
      <h2>Çalışan Listesi</h2>
      <ul>
        {personeller.map((p) => (
          <li
            key={p.id}
            style={{ cursor: "pointer", margin: "5px 0" }}
            onClick={() => setSeciliCalisan(p)}
          >
            {p.isim} {p.soyisim}
          </li>
        ))}
      </ul>
    </div>
  );
}
