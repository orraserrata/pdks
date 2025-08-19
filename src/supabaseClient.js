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
          // Safari için localStorage yerine sessionStorage kullan
          return sessionStorage.getItem(key);
        } catch (error) {
          console.error('Storage getItem error:', error);
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          // Safari için sessionStorage kullan
          sessionStorage.setItem(key, value);
        } catch (error) {
          console.error('Storage setItem error:', error);
        }
      },
      removeItem: (key) => {
        try {
          sessionStorage.removeItem(key);
        } catch (error) {
          console.error('Storage removeItem error:', error);
        }
      }
    }
  }
});
