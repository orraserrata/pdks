// components/CalisanListesi.js
import React from "react";

export default function CalisanListesi({ personeller, onCalisanSelect }) {
  return (
    <div>
      <h2>Çalışan Listesi</h2>
      <ul>
        {personeller.map((p) => (
          <li
            key={p.kullanici_id}
            style={{ cursor: "pointer", margin: "5px 0" }}
            onClick={() => onCalisanSelect(p)}
          >
            {p.isim || `ID: ${p.kullanici_id}`} {p.soyisim || ""}
          </li>
        ))}
      </ul>
    </div>
  );
}