// components/CalisanListesi.js
import React from "react";

export default function CalisanListesi({ personeller, onCalisanSelect }) {
  const sorted = (personeller || []).slice().sort((a, b) => {
    const aName = (a.isim || `ID ${a.kullanici_id}`) + " " + (a.soyisim || "");
    const bName = (b.isim || `ID ${b.kullanici_id}`) + " " + (b.soyisim || "");
    return aName.localeCompare(bName, 'tr', { sensitivity: 'base' });
  });
  return (
    <div>
      <h2>Çalışan Listesi</h2>
      {(!personeller || personeller.length === 0) ? (
        <div>Personel bulunamadı. Lütfen önce Personel Yönetimi sekmesinden ekleyin.</div>
      ) : (
        <div className="personList">
          {sorted.map((p) => (
            <button
              key={p.kullanici_id}
              type="button"
              className="personRow"
              onClick={() => onCalisanSelect(p)}
            >
              {p.isim || `ID: ${p.kullanici_id}`} {p.soyisim || ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}