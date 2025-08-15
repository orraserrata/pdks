from supabase import create_client, Client
import os

try:
    from dotenv import load_dotenv
    import os
    # Ana dizindeki .env dosyasını yükle
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    load_dotenv(env_path)
except Exception:
    pass

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://adpopdmavlseifoxpobo.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_SERVICE_KEY:
    raise RuntimeError("SUPABASE_SERVICE_KEY ortam değişkeni tanımlı değil.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def clear_processed_data():
    """Düzenli tablodaki tüm kayıtları sil"""
    print("Düzenli kayıtlar temizleniyor...")
    
    # Önce kaç kayıt olduğunu kontrol et
    count_result = supabase.table("personel_giris_cikis_duzenli").select("*", count="exact").execute()
    if getattr(count_result, 'error', None):
        print("Hata:", getattr(count_result, 'error', None))
        return
    
    count = getattr(count_result, 'count', 0)
    print(f"Silinecek kayıt sayısı: {count}")
    
    if count == 0:
        print("Silinecek kayıt yok.")
        return
    
    # Tüm kayıtları sil
    delete_result = supabase.table("personel_giris_cikis_duzenli").delete().neq("id", 0).execute()
    if getattr(delete_result, 'error', None):
        print("Silme hatası:", getattr(delete_result, 'error', None))
    else:
        print(f"Toplam {count} kayıt silindi.")

if __name__ == "__main__":
    clear_processed_data()

