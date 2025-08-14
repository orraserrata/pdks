import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import './App.css';
import CalisanListesi from "./components/CalisanListesi";
import CalisanDetay from "./components/CalisanDetay";
import PersonelYonetimi from "./components/PersonelYonetimi";
import AdminPanel from "./components/AdminPanel";
import AdminLogin from "./components/AdminLogin";
import AdminSettings from "./components/AdminSettings";
import TumCalisanlar from "./components/TumCalisanlar";
import Modal from "./components/Modal";

function App() {
  const [personeller, setPersoneller] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seciliCalisan, setSeciliCalisan] = useState(null);
  const [activeTab, setActiveTab] = useState('calisanlar'); // 'calisanlar' | 'personel' | 'admin'
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [session, setSession] = useState(null);

  useEffect(() => {
    async function fetchPersoneller() {
      const { data, error } = await supabase
        .from('personel')
        .select('kullanici_id, isim, soyisim, ise_giris_tarihi')
        .order('kullanici_id', { ascending: true });

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="container">Yükleniyor...</div>;

  return (
    <div className="App container">
      <h1 className="appTitle">PDKS Uygulaması</h1>

      <div className="toolbar">
        <div className="tabs">
        <button
          className={`tab ${activeTab === 'calisanlar' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('calisanlar')}
        >
          Çalışanlar
        </button>
        <button
          className={`tab ${activeTab === 'personel' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('personel')}
        >
          Personel Yönetimi
        </button>
        <button
          className={`tab ${activeTab === 'tumCalisanlar' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('tumCalisanlar')}
        >
          Tüm Çalışanlar
        </button>
        <button className={`tab ${activeTab === 'admin' ? 'tab-active' : ''}`} onClick={() => setActiveTab('admin')}>Admin</button>
        </div>
        <div className="account">
          {session ? (
            <>
              <span>Hesap: {session.user?.email}</span>
              <button className="tab" onClick={async () => { await supabase.auth.signOut(); }}>Çıkış</button>
            </>
          ) : (
            <button className="tab" onClick={() => setShowAdminLogin(true)}>Admin Giriş</button>
          )}
        </div>
      </div>

      {activeTab === 'personel' ? (
        <div className="card">
          <PersonelYonetimi onChanged={() => window.location.reload()} />
        </div>
      ) : activeTab === 'tumCalisanlar' ? (
        <div className="card">
          <TumCalisanlar />
        </div>
      ) : activeTab === 'admin' ? (
        <div className="card">
          <AdminPanel />
          <div style={{ height: 12 }} />
          <AdminSettings />
        </div>
      ) : (
        <div className="layout">
          <div className="card">
            <CalisanListesi
              personeller={personeller}
              onCalisanSelect={(calisan) => setSeciliCalisan(calisan)}
            />
          </div>
          {seciliCalisan && (
            <div className="card">
              <CalisanDetay calisan={seciliCalisan} />
            </div>
          )}
        </div>
      )}

      <Modal open={showAdminLogin} onClose={() => setShowAdminLogin(false)} title="Admin Girişi">
        <AdminLogin onSuccess={() => setShowAdminLogin(false)} />
      </Modal>
    </div>
  );
}

export default App;
