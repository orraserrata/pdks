"""Maaş ayarı olmayan tüm personel için varsayılan maas_ayarlari kaydı oluşturur."""
import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("REACT_APP_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
DEFAULT_HEDEF_SAAT = 240

def main():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise SystemExit("SUPABASE_URL ve SUPABASE_SERVICE_KEY .env dosyasında tanımlı olmalı.")

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    personel_res = supabase.table("personel").select("kullanici_id, aktif").execute()
    personeller = personel_res.data or []

    maas_res = supabase.table("maas_ayarlari").select("kullanici_id").execute()
    mevcut_ids = {m["kullanici_id"] for m in (maas_res.data or [])}

    eklenecek = [p for p in personeller if p["kullanici_id"] not in mevcut_ids]
    if not eklenecek:
        print("Tum personelin maas ayari zaten mevcut.")
        return

    print(f"{len(eklenecek)} personel icin maas ayari olusturuluyor...")
    for p in eklenecek:
        payload = {
            "kullanici_id": p["kullanici_id"],
            "aylik_maas": 0,
            "hedef_saat": DEFAULT_HEDEF_SAAT,
            "aktif": p.get("aktif", True),
        }
        res = supabase.table("maas_ayarlari").insert(payload).execute()
        if getattr(res, "error", None):
            print(f"  Hata (kullanici_id={p['kullanici_id']}): {res.error}")
        else:
            print(f"  Eklendi: kullanici_id={p['kullanici_id']}, aktif={payload['aktif']}")

    print("Backfill tamamlandi.")

if __name__ == "__main__":
    main()
