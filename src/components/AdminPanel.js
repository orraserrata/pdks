import React from "react";
import SifreYonetimi from "./SifreYonetimi";
import KullaniciHesaplariYonetimi from "./KullaniciHesaplariYonetimi";
import AdminSettings from "./AdminSettings";

export default function AdminPanel() {
  return (
    <div className="admin-page">
      <h2>Admin</h2>
      <SifreYonetimi />
      <KullaniciHesaplariYonetimi />
      <AdminSettings />
    </div>
  );
}
