import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL ve Anon Key environment variable olarak tanımlanmalıdır.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: {
      getItem: (key) => {
        try {
          // Önce localStorage'dan dene
          const value = localStorage.getItem(key);
          if (value) return value;
          
          // localStorage'da yoksa sessionStorage'dan dene
          return sessionStorage.getItem(key);
        } catch (error) {
          console.error('Storage getItem error:', error);
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          // Hem localStorage hem sessionStorage'a kaydet
          localStorage.setItem(key, value);
          sessionStorage.setItem(key, value);
        } catch (error) {
          console.error('Storage setItem error:', error);
          // Hata durumunda sadece sessionStorage'a kaydet
          try {
            sessionStorage.setItem(key, value);
          } catch (e) {
            console.error('SessionStorage setItem error:', e);
          }
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        } catch (error) {
          console.error('Storage removeItem error:', error);
        }
      }
    }
  }
});
