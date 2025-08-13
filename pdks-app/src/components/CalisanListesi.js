// components/CalisanListesi.js
import React from "react";
import { supabase } from "../supabaseClient";

export default function CalisanListesi({ personeller, onCalisanSelect }) {
  if (!personeller || personeller.length === 0) {
    return <div>Çalışan listesi boş.</div>;
  }

 return (
    <div>
      <h2>Çalışan Listesi</h2>
      <ul>
        {personeller.map((p) => (
          <li
            key={p.kullanici_id}
            style={{ cursor: "pointer", margin: "5px 0" }}
            onClick={() => setSeciliCalisan(p)}
          >
            {p.isim || `ID: ${p.kullanici_id}`} {p.soyisim || ""}
          </li>
        ))}
      </ul>
    </div>
  );

}
