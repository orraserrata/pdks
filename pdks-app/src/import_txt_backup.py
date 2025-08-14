import os
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Any

from supabase import create_client, Client

try:
    from dotenv import load_dotenv  # type: ignore
    # Proje kökündeki .env'yi yükle
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    load_dotenv(env_path)
except Exception:
    pass

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://adpopdmavlseifoxpobo.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcG9wZG1hdmxzZWlmb3hwb2JvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDk4NDYyMywiZXhwIjoyMDcwNTYwNjIzfQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8")

if not SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_KEY == "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcG9wZG1hdmxzZWlmb3hwb2JvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDk4NDYyMywiZXhwIjoyMDcwNTYwNjIzfQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8":
    raise RuntimeError("SUPABASE_SERVICE_KEY tanımlı değil (.env dosyasına gerçek service key ekleyin)")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def parse_txt_line(line: str) -> Dict[str, Any] | None:
    """TXT satırını parse eder."""
    line = line.strip()
    if not line:
        return None
    
    parts = line.split(',')
    if len(parts) != 5:
        print(f"Geçersiz satır formatı: {line}")
        return None
    
    try:
        device_id = parts[0].strip()
        user_id_str = parts[1].strip()
        status = parts[2].strip()
        date_str = parts[3].strip()
        time_str = parts[4].strip()
        
        # Kullanıcı ID'yi integer'a çevir (başındaki sıfırları kaldır)
        user_id = int(user_id_str)
        
        # Tarih ve saati birleştir
        datetime_str = f"{date_str} {time_str}"
        timestamp = datetime.strptime(datetime_str, "%Y/%m/%d %H:%M:%S")
        
        return {
            "device_id": device_id,
            "kullanici_id": user_id,
            "status": status,
            "timestamp": timestamp,
        }
    except Exception as e:
        print(f"Satır parse hatası '{line}': {e}")
        return None


def ensure_personel_exists(user_ids: List[int]) -> None:
    """Eksik personel kayıtlarını basit placeholder ile oluşturur."""
    if not user_ids:
        return
    
    # Mevcutları sorgula
    existing = supabase.table("personel").select("kullanici_id").in_("kullanici_id", user_ids).execute()
    existing_ids = {row["kullanici_id"] for row in getattr(existing, "data", [])} if not getattr(existing, "error", None) else set()
    to_create = [uid for uid in user_ids if uid not in existing_ids]
    
    if not to_create:
        return
    
    payloads = [{
        "kullanici_id": uid,
        "isim": f"Kullanıcı {uid}",
        "soyisim": "",
        "ise_giris_tarihi": datetime.today().date().isoformat(),
    } for uid in to_create]
    
    res = supabase.table("personel").upsert(payloads).execute()
    if getattr(res, "error", None):
        print("Personel upsert hatası:", getattr(res, "error", None))
    else:
        print(f"{len(to_create)} personel kaydı oluşturuldu.")


def insert_raw_records(records: List[Dict[str, Any]]) -> None:
    """Ham tabloya kayıt ekler; duplicate'ları atlar."""
    inserted_count = 0
    skipped_count = 0
    
    for rec in records:
        user_id = rec["kullanici_id"]
        timestamp = rec["timestamp"]
        timestamp_str = timestamp.strftime("%Y-%m-%d %H:%M:%S")
        
        # Duplicate kontrolü
        exists = supabase.table("personel_giris_cikis").select("id").eq("kullanici_id", user_id).eq("giris_tarihi", timestamp_str).limit(1).execute()
        if getattr(exists, "data", []):
            skipped_count += 1
            continue
        
        payload = {
            "kullanici_id": user_id,
            "isim": f"Kullanıcı {user_id}",
            "giris_tarihi": timestamp_str,
            "device_uid": rec.get("device_id"),
            "status_code": rec.get("status"),
            "verify_method": None,
        }
        
        res = supabase.table("personel_giris_cikis").insert(payload).execute()
        if getattr(res, "error", None):
            print("Ham insert hata:", getattr(res, "error", None))
        else:
            inserted_count += 1
    
    print(f"Ham kayıtlar: {inserted_count} eklendi, {skipped_count} atlandı (zaten mevcut).")


def run_import(file_path: str, auto_create_personel: bool = True) -> None:
    """TXT dosyasını okuyup Supabase'e aktarır."""
    print(f"TXT dosyası okunuyor: {file_path}")
    
    records = []
    user_ids = set()
    
    with open(file_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            if line_num % 1000 == 0:
                print(f"Satır {line_num} işlendi...")
            
            record = parse_txt_line(line)
            if record:
                records.append(record)
                user_ids.add(record["kullanici_id"])
    
    print(f"Toplam {len(records)} kayıt okundu.")
    print(f"Benzersiz kullanıcı sayısı: {len(user_ids)}")
    
    if not records:
        print("İşlenecek kayıt bulunamadı.")
        return
    
    # Personel kayıtlarını oluştur
    if auto_create_personel:
        ensure_personel_exists(list(user_ids))
    
    # Ham kayıtları ekle
    insert_raw_records(records)
    
    print("Import tamamlandı!")
    print("Not: Ham kayıtlar eklendi. Giriş-çıkış çiftleri için 'python migrate_all_data.py' çalıştırın.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TXT backup dosyalarını Supabase'e aktar")
    parser.add_argument("--file", required=True, help="TXT dosya yolu")
    parser.add_argument("--no-auto-create-personel", dest="auto_create_personel", action="store_false", help="Eksik personel kayıtlarını otomatik oluşturma")
    args = parser.parse_args()
    
    run_import(
        file_path=args.file,
        auto_create_personel=args.auto_create_personel,
    )
