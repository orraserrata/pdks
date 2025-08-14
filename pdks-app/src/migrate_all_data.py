from supabase import create_client, Client
from datetime import datetime, timedelta
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

def get_all_raw_attendance():
    """Ham tablodaki tüm kayıtları al"""
    print("Ham kayıtlar alınıyor...")
    
    result = supabase.table("personel_giris_cikis").select("*").order("giris_tarihi", desc=False).execute()
    if getattr(result, 'error', None):
        print("Hata:", getattr(result, 'error', None))
        return []
    
    records = getattr(result, 'data', [])
    print(f"Toplam {len(records)} ham kayıt bulundu.")
    return records

def get_existing_processed_records():
    """Düzenli tablodaki mevcut kayıtları al"""
    print("Mevcut düzenli kayıtlar alınıyor...")
    
    result = supabase.table("personel_giris_cikis_duzenli").select("*").execute()
    if getattr(result, 'error', None):
        print("Hata:", getattr(result, 'error', None))
        return []
    
    records = getattr(result, 'data', [])
    print(f"Toplam {len(records)} düzenli kayıt bulundu.")
    return records

def generate_pairs_from_raw(raw_records):
    """Ham kayıtlardan giriş-çıkış çiftlerini oluştur"""
    print("Giriş-çıkış çiftleri oluşturuluyor...")
    
    pairs = []
    attendance_by_user_and_day = {}
    day_start_hour = int(os.getenv("SYNC_DAY_START_HOUR", "5"))

    for record in raw_records:
        user_id = record['kullanici_id']
        time_str = record['giris_tarihi']
        
        # string -> datetime
        try:
            time_dt = datetime.fromisoformat(time_str)
        except Exception:
            print(f"Tarih parse hatası: {time_str}")
            continue
        
        # İş günü kaydırması - gece yarısından sonraki kayıtlar için özel mantık
        # Eğer saat 00:00-05:00 arasındaysa, bu kayıt önceki günün devamı
        # Eğer saat 05:00-23:59 arasındaysa, bu kayıt bugünün başlangıcı
        hour = time_dt.hour
        
        if hour < day_start_hour:
            # Gece yarısından sonra, önceki günün devamı
            workday_dt = time_dt - timedelta(days=1)
        else:
            # Gündüz, bugünün başlangıcı
            workday_dt = time_dt
            
        workday_date = workday_dt.date().isoformat()
        
        attendance_by_user_and_day.setdefault(user_id, {}).setdefault(workday_date, []).append(time_dt)

    for user_id, days_data in attendance_by_user_and_day.items():
        for workday_date, times in days_data.items():
            times.sort()  # Tarihe göre sırala
            
            # Her iş günü için ilk giriş ve son çıkış
            giris = times[0]
            cikis = times[-1] if len(times) > 1 else None  # Tek kayıt varsa çıkış null

            pairs.append({
                "kullanici_id": user_id,
                "giris_tarihi": giris.isoformat(sep=' '),
                "cikis_tarihi": cikis.isoformat(sep=' ') if cikis else None,
                "workday_date": workday_date,
                "admin_locked": False
            })

    print(f"Toplam {len(pairs)} çift oluşturuldu.")
    return pairs

def save_missing_pairs(pairs, existing_records):
    """Eksik çiftleri düzenli tabloya kaydet"""
    print("Eksik kayıtlar kaydediliyor...")
    
    # Mevcut kayıtları (kullanici_id, workday_date) anahtarıyla grupla
    existing_keys = set()
    for record in existing_records:
        key = (record['kullanici_id'], record.get('workday_date'))
        existing_keys.add(key)
    
    # Eksik kayıtları bul ve kaydet
    saved_count = 0
    skipped_count = 0
    
    for pair in pairs:
        key = (pair['kullanici_id'], pair.get('workday_date'))
        
        if key in existing_keys:
            skipped_count += 1
            continue
        
        # Yeni kayıt ekle
        res = supabase.table("personel_giris_cikis_duzenli").insert(pair).execute()
        if getattr(res, 'error', None):
            print(f"Kaydetme hatası: {getattr(res, 'error', None)} - {pair}")
        else:
            saved_count += 1
            print(f"Yeni kayıt eklendi: {pair['kullanici_id']} - {pair.get('workday_date')}")
    
    print(f"Toplam {saved_count} yeni kayıt eklendi, {skipped_count} kayıt atlandı (zaten mevcut).")

def main():
    print("=== Tüm Veri Migration ===")
    
    # 1. Ham kayıtları al
    raw_records = get_all_raw_attendance()
    if not raw_records:
        print("Ham kayıt bulunamadı.")
        return
    
    # 2. Mevcut düzenli kayıtları al
    existing_records = get_existing_processed_records()
    
    # 3. Ham kayıtlardan çiftler oluştur
    pairs = generate_pairs_from_raw(raw_records)
    if not pairs:
        print("Çift oluşturulamadı.")
        return
    
    # 4. Eksik kayıtları kaydet
    save_missing_pairs(pairs, existing_records)
    
    print("\n=== Migration Tamamlandı ===")
    print("Tüm ham kayıtlar düzenli tabloya aktarıldı.")

if __name__ == "__main__":
    main()
