import React from "react";
import SifreYonetimi from "./SifreYonetimi";
import KullaniciHesaplariYonetimi from "./KullaniciHesaplariYonetimi";

export default function AdminPanel() {
  return (
    <div>
      <h2>Admin Panel</h2>
      <SifreYonetimi />
      <div style={{ height: 32 }} />
      <KullaniciHesaplariYonetimi />
    </div>
  );
}