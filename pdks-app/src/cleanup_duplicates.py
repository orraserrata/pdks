from supabase import create_client, Client
from datetime import datetime, timedelta
import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://adpopdmavlseifoxpobo.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_SERVICE_KEY:
    raise RuntimeError("SUPABASE_SERVICE_KEY ortam değişkeni tanımlı değil.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def cleanup_duplicates():
    """Duplicate kayıtları temizle"""
    print("Duplicate kayıtları temizleme başlatılıyor...")
    
    # Tüm kayıtları al
    result = supabase.table("personel_giris_cikis_duzenli").select("*").execute()
    if getattr(result, 'error', None):
        print("Hata:", getattr(result, 'error', None))
        return
    
    records = getattr(result, 'data', [])
    print(f"Toplam {len(records)} kayıt bulundu.")
    
    # Duplicate'ları bul
    seen = set()
    duplicates = []
    
    for record in records:
        key = (record['kullanici_id'], record['giris_tarihi'])
        if key in seen:
            duplicates.append(record['id'])
        else:
            seen.add(key)
    
    print(f"{len(duplicates)} duplicate kayıt bulundu.")
    
    if duplicates:
        # Duplicate'ları sil
        for dup_id in duplicates:
            delete_result = supabase.table("personel_giris_cikis_duzenli").delete().eq("id", dup_id).execute()
            if getattr(delete_result, 'error', None):
                print(f"Silme hatası ID {dup_id}:", getattr(delete_result, 'error', None))
            else:
                print(f"Duplicate kayıt silindi: ID {dup_id}")
    
    print("Temizlik tamamlandı.")

def backfill_workday_dates():
    """Mevcut kayıtlara workday_date ekle"""
    print("Workday date'leri dolduruluyor...")
    
    day_start_hour = int(os.getenv("SYNC_DAY_START_HOUR", "5"))
    
    # Tüm kayıtları al
    result = supabase.table("personel_giris_cikis_duzenli").select("*").execute()
    if getattr(result, 'error', None):
        print("Hata:", getattr(result, 'error', None))
        return
    
    records = getattr(result, 'data', [])
    print(f"Toplam {len(records)} kayıt işlenecek.")
    
    updated_count = 0
    for record in records:
        if record.get('workday_date') is None:
            # workday_date hesapla
            try:
                giris_dt = datetime.fromisoformat(record['giris_tarihi'])
                workday_dt = giris_dt - timedelta(hours=day_start_hour)
                workday_date = workday_dt.date().isoformat()
                
                # Güncelle
                update_result = supabase.table("personel_giris_cikis_duzenli").update({
                    "workday_date": workday_date
                }).eq("id", record['id']).execute()
                
                if getattr(update_result, 'error', None):
                    print(f"Güncelleme hatası ID {record['id']}:", getattr(update_result, 'error', None))
                else:
                    updated_count += 1
                    print(f"Workday date eklendi: ID {record['id']} -> {workday_date}")
            except Exception as e:
                print(f"Tarih işleme hatası ID {record['id']}: {e}")
    
    print(f"Toplam {updated_count} kayıt güncellendi.")

if __name__ == "__main__":
    print("=== Duplicate Temizlik ===")
    cleanup_duplicates()
    print("\n=== Workday Date Doldurma ===")
    backfill_workday_dates()
    print("\nİşlem tamamlandı.")
