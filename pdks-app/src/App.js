import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import CalisanListesi from "./components/CalisanListesi";
import CalisanDetay from "./components/CalisanDetay";
import PersonelYonetimi from "./components/PersonelYonetimi";
import AdminPanel from "./components/AdminPanel";
import AdminLogin from "./components/AdminLogin";
import AdminSettings from "./components/AdminSettings";
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
      // Önce görünümden dene; yoksa eski tabloya düş
      let resp = await supabase
        .from('personel_duzenli_with_names')
        .select('*')
        .order('kullanici_id', { ascending: true });

      if (resp.error) {
        resp = await supabase
          .from('personel_giris_cikis_duzenli')
          .select('*')
          .order('kullanici_id', { ascending: true });
      }

      if (resp.error) {
        console.error('Veri çekme hatası:', resp.error);
        setPersoneller([]);
      } else {
        const uniqueByUser = new Map();
        (resp.data || []).forEach((row) => {
          if (!uniqueByUser.has(row.kullanici_id)) {
            uniqueByUser.set(row.kullanici_id, row);
          }
        });
        setPersoneller(Array.from(uniqueByUser.values()));
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
