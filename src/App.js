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
import HataBildirimleriListesi from "./components/HataBildirimleriListesi";
import HesapOlustur from "./components/HesapOlustur";
import GirisYap from "./components/GirisYap";
import Modal from "./components/Modal";
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
  const [personeller, setPersoneller] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seciliCalisan, setSeciliCalisan] = useState(null);
  const [activeTab, setActiveTab] = useState('calisanlar'); // 'calisanlar' | 'personel' | 'admin' | 'hesapOlustur'
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showHesapOlustur, setShowHesapOlustur] = useState(false);
  const [showGirisYap, setShowGirisYap] = useState(false);
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  async function fetchPersoneller() {
    const { data, error } = await supabase
      .from('personel')
      .select('kullanici_id, isim, soyisim, ise_giris_tarihi, aktif')
      .order('kullanici_id', { ascending: true });

    if (error) {
      console.error('Veri çekme hatası:', error);
      setPersoneller([]);
    } else {
      setPersoneller(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchPersoneller();
  }, []);

  // Kullanıcı profilini yükle
  useEffect(() => {
    async function loadUserProfile() {
      if (!session?.user) {
        setUserProfile(null);
        setProfileLoading(false);
        return;
      }
      
      setProfileLoading(true);
      
      try {
        const email = session?.user?.email || null;
        
        // Önce kullanici_profilleri tablosundan kontrol et
        let { data, error } = await supabase
          .from("kullanici_profilleri")
          .select("*")
          .eq("email", email)
          .maybeSingle();
        
        if (data) {
          setUserProfile(data);
        } else {
          // Profil bulunamadı - admin_users tablosundan kontrol et
          // admin_users tablosunda email yok, user_id var
          // Önce auth.users tablosundan user_id'yi bul
          const { data: authUser } = await supabase.auth.getUser();
          
          if (authUser?.user?.id) {
            const adminCheck = await supabase
              .from("admin_users")
              .select("user_id")
              .eq("user_id", authUser.user.id)
              .maybeSingle();
            
            console.log("Admin kontrolü sonucu:", adminCheck);
            
            if (adminCheck.data) {
              // Admin kullanıcı - geçici admin profili oluştur
              const tempAdminProfile = {
                id: -1,
                kullanici_id: null,
                email: email,
                isim: "Admin",
                soyisim: "Kullanıcı",
                is_admin: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              console.log("Geçici admin profili oluşturuldu:", tempAdminProfile);
              setUserProfile(tempAdminProfile);
            } else {
              console.log("Admin değil, profil yok");
              setUserProfile(null);
            }
          } else {
            console.log("Auth user bulunamadı");
            setUserProfile(null);
          }
        }
      } catch (err) {
        console.error("Profil yükleme hatası:", err);
        setUserProfile(null);
      } finally {
        setProfileLoading(false);
      }
    }

    loadUserProfile();
  }, [session]);

  useEffect(() => {
    // İlk yüklemede session'ı al
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Initial session:', session);
        setSession(session);
      } catch (error) {
        console.error('Session getirme hatası:', error);
        setSession(null);
      }
    };

    getInitialSession();

    // Auth state değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session);
      
      if (event === 'SIGNED_IN') {
        console.log('Kullanıcı giriş yaptı');
        setSession(session);
      } else if (event === 'SIGNED_OUT') {
        console.log('Kullanıcı çıkış yaptı');
        setSession(null);
        setUserProfile(null);
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token yenilendi');
        setSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="container">Yükleniyor...</div>;

  return (
    <ErrorBoundary>
      <div className="App container">
        <div className="toolbar">
          <div className="toolbar-left">
            <h1 className="appTitle">PDKS</h1>
          </div>
          <div className="toolbar-center">
            <div className="tabs">
              <button
                className={`tab ${activeTab === 'calisanlar' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('calisanlar')}
              >
                Çalışanlar
              </button>
              {/* Admin sekmeleri - sadece admin kullanıcılar görebilir */}
              {userProfile?.is_admin && (
                <>
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
                </>
              )}
              
              {/* Hata Bildirimleri - hem normal kullanıcılar hem admin kullanıcılar görebilir */}
              <button 
                className={`tab ${activeTab === 'hataBildirimleri' ? 'tab-active' : ''}`} 
                onClick={() => setActiveTab('hataBildirimleri')}
              >
                Hata Bildirimleri
              </button>
            </div>
          </div>
          <div className="toolbar-right">
            <div className="account">
              {session ? (
                <>
                  <span>Hesap: {session.user?.email}</span>
                  <button className="tab" onClick={() => {
                    console.log("Çıkış butonuna tıklandı");
                    // Önce localStorage'ı temizle
                    localStorage.clear();
                    sessionStorage.clear();
                    
                    supabase.auth.signOut().then(() => {
                      console.log("Çıkış başarılı");
                      setSession(null); // Session state'ini temizle
                      window.location.reload(); // Sayfayı yenile
                    }).catch((error) => {
                      console.error("Çıkış hatası:", error);
                    });
                  }}>Çıkış</button>
                </>
              ) : (
                <>
                  <button className="tab" onClick={() => setShowHesapOlustur(true)}>Hesap Oluştur</button>
                  <button className="tab" onClick={() => setShowGirisYap(true)}>Giriş Yap</button>
                </>
              )}
            </div>
          </div>
        </div>

        {activeTab === 'personel' && userProfile?.is_admin ? (
          <div className="card">
            <PersonelYonetimi onChanged={() => {
              // Personel listesini yeniden yükle
              fetchPersoneller();
            }} />
          </div>
        ) : activeTab === 'tumCalisanlar' && userProfile?.is_admin ? (
          <div className="card">
            <TumCalisanlar />
          </div>
        ) : activeTab === 'admin' && userProfile?.is_admin ? (
          <div className="card">
            <AdminPanel />
            <div style={{ height: 12 }} />
            <AdminSettings />
          </div>
        ) : activeTab === 'hataBildirimleri' ? (
          <div className="card">
            <HataBildirimleriListesi />
          </div>
        ) : (
          <div className="layout">
            <div className="card">
              <CalisanListesi
                personeller={personeller}
                onCalisanSelect={(calisan) => setSeciliCalisan(calisan)}
                session={session}
              />
            </div>
            {seciliCalisan && (
              <div className="card">
                <CalisanDetay calisan={seciliCalisan} />
              </div>
            )}
          </div>
        )}

                <Modal open={showHesapOlustur} onClose={() => setShowHesapOlustur(false)} title="Hesap Oluştur">
          <HesapOlustur onSuccess={() => setShowHesapOlustur(false)} />
        </Modal>
        
        <Modal open={showGirisYap} onClose={() => setShowGirisYap(false)} title="Giriş Yap">
          <GirisYap onSuccess={() => setShowGirisYap(false)} />
        </Modal>
      </div>
    </ErrorBoundary>
  );
}

export default App;
