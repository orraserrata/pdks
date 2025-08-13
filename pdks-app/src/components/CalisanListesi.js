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
      <ul style={{ listStyleType: "none", padding: 0 }}>
        {personeller.map((p) => (
          <li
            key={p.id}
            style={{ cursor: "pointer", margin: "5px 0", padding: "5px", border: "1px solid #ccc", borderRadius: "4px" }}
            onClick={() => onCalisanSelect(p)}
          >
            {p.isim} {p.soyisim}
          </li>
        ))}
      </ul>
    </div>
  );
}
