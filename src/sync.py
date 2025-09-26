from zk import ZK
from supabase import create_client, Client
from datetime import datetime, timedelta
import os

try:
    from dotenv import load_dotenv  # type: ignore
    import os
    # Ana dizindeki .env dosyasını yükle
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    load_dotenv(env_path)
except Exception:
    pass

# Supabase bilgileri (Service Role anahtarı ile RLS baypas edilir)
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://adpopdmavlseifoxpobo.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_SERVICE_KEY:
    raise RuntimeError(
        "SUPABASE_SERVICE_KEY ortam değişkeni tanımlı değil. Lütfen Service Role key ile ayarlayın."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def record_exists(table, user_id, timestamp):
    """Belirli kayıt var mı kontrol et"""
    result = supabase.table(table).select("*").eq("kullanici_id", user_id).eq("giris_tarihi", timestamp).execute()
    return bool(result.data)

def save_to_supabase(records):
    """Ham veriyi supabase'e kaydet"""
    for rec in records:
        user_id = rec["user_id"]
        name = rec["name"]
        ts_val = rec["timestamp"]
        if isinstance(ts_val, datetime):
            timestamp = ts_val.strftime("%Y-%m-%d %H:%M:%S")
        else:
            # Beklenmedik tipte ise stringe çevirmeyi dene
            timestamp = str(ts_val)

        if record_exists("personel_giris_cikis", user_id, timestamp):
            print(f"Zaten var, eklenmedi: {user_id} - {timestamp}")
            continue

        record = {
            "kullanici_id": user_id,
            "isim": name,
            "giris_tarihi": timestamp,
            "device_uid": rec.get("device_uid"),
            "status_code": rec.get("status_code"),
            "verify_method": rec.get("verify_method"),
        }

        try:
            response = supabase.table("personel_giris_cikis").insert(record).execute()
            err = getattr(response, 'error', None)
            if err:
                if "duplicate key" in str(err).lower():
                    print(f"Duplicate key hatası, kayıt zaten var: {user_id} - {timestamp}")
                else:
                    print("Hata supabase insert:", err)
            else:
                print(f"Ham kayıt eklendi: {record}")
        except Exception as e:
            if "duplicate key" in str(e).lower():
                print(f"Duplicate key hatası, kayıt zaten var: {user_id} - {timestamp}")
            else:
                print(f"Beklenmeyen hata: {e}")

def get_raw_attendance():
    """Ham tabloyu al"""
    result = supabase.table("personel_giris_cikis") \
        .select("kullanici_id,giris_tarihi") \
        .order("giris_tarihi", desc=False) \
        .execute()
    err = getattr(result, 'error', None)
    if err:
        print("Hata supabase select:", err)
        return []
    return result.data

def get_all_raw_attendance():
    """Tüm ham kayıtları al"""
    print("Tüm ham kayıtlar alınıyor...")
    return get_raw_attendance()

def get_new_raw_attendance():
    """Sadece henüz işlenmemiş ham kayıtları al"""
    print("Yeni ham kayıtlar kontrol ediliyor...")
    
    # En son işlenen kaydın tarihini bul
    last_processed = supabase.table("personel_giris_cikis_duzenli") \
        .select("giris_tarihi") \
        .order("giris_tarihi", desc=True) \
        .limit(1) \
        .execute()
    
    last_date = None
    if not getattr(last_processed, 'error', None) and getattr(last_processed, 'data', []):
        last_date = getattr(last_processed, 'data', [])[0]['giris_tarihi']
        print(f"Son işlenen kayıt tarihi: {last_date}")
    
    # Yeni kayıtları al
    query = supabase.table("personel_giris_cikis") \
        .select("kullanici_id,giris_tarihi") \
        .order("giris_tarihi", desc=False)
    
    if last_date:
        query = query.gt("giris_tarihi", last_date)
    
    result = query.execute()
    err = getattr(result, 'error', None)
    if err:
        print("Hata supabase select:", err)
        return []
    
    data = getattr(result, 'data', [])
    print(f"Yeni kayıt sayısı: {len(data)}")
    return data

def generate_pairs(attendance):
    """Ham kayıtları giriş-çıkış çiftlerine dönüştür"""
    pairs = []
    attendance_by_user_and_day = {}

    for row in attendance:
        user = row['kullanici_id']
        time_str = row['giris_tarihi']
        # string -> datetime
        try:
            time_dt = datetime.fromisoformat(time_str)
        except Exception:
            time_dt = time_str if isinstance(time_str, datetime) else None
        if time_dt is None:
            continue
        
        # İş günü kaydırması - gece yarısından sonraki kayıtlar için özel mantık
        day_start_hour = int(os.getenv("SYNC_DAY_START_HOUR", "5"))
        
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
        
        attendance_by_user_and_day.setdefault(user, {}).setdefault(workday_date, []).append(time_dt)

    for user, days_data in attendance_by_user_and_day.items():
        for workday_date, times in days_data.items():
            times.sort()  # Tarihe göre sırala
            
            # YENİ: Minimum süre kontrolü - çok yakın kayıtları filtrele
            min_interval_seconds = int(os.getenv("SYNC_MIN_INTERVAL_SECONDS", "300"))  # Varsayılan 5 dakika (300 saniye)
            min_interval = timedelta(seconds=min_interval_seconds)
            
            filtered_times = []
            for i, time in enumerate(times):
                if i == 0:
                    # İlk kayıt her zaman alınır
                    filtered_times.append(time)
                    print(f"İlk kayıt alındı: {user} - {time}")
                else:
                    # Son kayıttan minimum süre geçmişse al
                    time_diff = time - filtered_times[-1]
                    if time_diff >= min_interval:
                        filtered_times.append(time)
                        print(f"Yeni kayıt alındı: {user} - {time} (önceki: {filtered_times[-1]}, fark: {time_diff.total_seconds():.0f}s)")
                    else:
                        print(f"Çok yakın kayıt filtrelendi: {user} - {time} (önceki: {filtered_times[-1]}, fark: {time_diff.total_seconds():.0f}s)")
            
            # Ardışık giriş-çıkış çiftleri oluştur
            for i in range(0, len(filtered_times), 2):
                giris = filtered_times[i]
                
                # Eğer bir sonraki kayıt varsa, o çıkış olur
                if i + 1 < len(filtered_times):
                    cikis = filtered_times[i + 1]
                    print(f"Çift oluşturuldu: {user} - Giriş: {giris}, Çıkış: {cikis}")
                else:
                    # Son kayıt tek başına kalırsa, sadece giriş olur
                    cikis = None
                    print(f"Tek giriş: {user} - Giriş: {giris} (çıkış yok)")

                pairs.append({
                    "kullanici_id": user,
                    "giris_tarihi": giris.isoformat(sep=' '),
                    "cikis_tarihi": cikis.isoformat(sep=' ') if cikis else None,
                    "workday_date": workday_date,
                    "admin_locked": False
                })

    return pairs

def _split_name(full_name: str):
    if not full_name:
        return "", ""
    parts = str(full_name).strip().split(" ", 1)
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[1]

def ensure_personel(users_map, attendance_list):
    """Cihazdaki kullanıcıları personel tablosuna (eksikleri) ekle.
    ise_giris_tarihi olarak kullanıcının ilk attendance gününü veya bugünü kullanır.
    """
    # En erken zaman (gün) tespiti
    earliest_by_user = {}
    for a in attendance_list:
        uid_str = getattr(a, "user_id", None)
        ts = getattr(a, "timestamp", None)
        if not uid_str or not isinstance(ts, datetime):
            continue
        try:
            uid_int = int(uid_str)
        except Exception:
            continue
        day = ts.date().isoformat()
        cur = earliest_by_user.get(uid_int)
        if cur is None or day < cur:
            earliest_by_user[uid_int] = day

    # Payload oluştur
    for user_id, name in users_map.items():
        try:
            user_id_int = int(user_id)
        except Exception:
            continue
        
        # Mevcut var mı kontrol et
        existing = supabase.table("personel").select("kullanici_id, aktif").eq("kullanici_id", user_id_int).execute()
        if getattr(existing, 'data', []):
            existing_data = existing.data[0]
            if not existing_data.get('aktif', True):
                continue  # Pasif personel, atla
            continue  # Zaten var ve aktif
        
        # Ekle
        first_day = earliest_by_user.get(user_id_int, datetime.now().date().isoformat())
        name_parts = _split_name(name)
        
        payload = {
            "kullanici_id": user_id_int,
            "isim": name_parts[0],
            "soyisim": name_parts[1],
            "ise_giris_tarihi": first_day,
            "aktif": True
        }
        
        res = supabase.table("personel").insert(payload).execute()
        if getattr(res, 'error', None):
            print("Hata personel insert:", getattr(res, 'error', None))
        else:
            print(f"Personel eklendi: {payload}")

def save_pairs(pairs):
    """Giriş-çıkış çiftlerini düzenli tabloya kaydet.
    Yoksa güncelle; mevcut yoksa ekle.
    """
    for p in pairs:
        workday = p.get("workday_date")
        if not workday:
            print(f"Workday date eksik, atlandı: {p}")
            continue
            
        # 1) Mevcut bir kayıt var mı? (workday_date üzerinden)
        existing = supabase.table("personel_giris_cikis_duzenli") \
            .select("id, admin_locked") \
            .eq("kullanici_id", p["kullanici_id"]) \
            .eq("workday_date", workday) \
            .execute()
        err = getattr(existing, 'error', None)
        rows = getattr(existing, 'data', []) if not err else []

        if rows:
            row = rows[0]
            if row.get("admin_locked"):
                print(f"Düzenli kayıt admin kilitli, atlandı: {p}")
                continue
            # Güncelle
            upd = supabase.table("personel_giris_cikis_duzenli").update({
                "giris_tarihi": p["giris_tarihi"],
                "cikis_tarihi": p["cikis_tarihi"],
                "admin_locked": False  # Cihazdan gelen veri kilidi açar
            }).eq("id", row["id"]).execute()
            if getattr(upd, 'error', None):
                print("Hata düzenli tablo update:", getattr(upd, 'error', None))
            else:
                print(f"Düzenli kayıt güncellendi: {p}")
        else:
            # Ekle
            insert_payload = dict(p)
            res = supabase.table("personel_giris_cikis_duzenli").insert(insert_payload).execute()
            if getattr(res, 'error', None):
                print("Hata düzenli tablo insert:", getattr(res, 'error', None))
            else:
                print(f"Düzenli kayıt eklendi: {insert_payload}")

def main():
    zk = ZK('192.168.0.139', port=4370)
    try:
        conn = zk.connect()

        # Kullanıcı ID -> isim eşlemesi
        users = {user.user_id: user.name for user in conn.get_users()}
        attendance = conn.get_attendance()

        # ID → isim ekle ve cihaz alanlarını taşı
        attendance_records = []
        for a in attendance:
            # Ham veriyi logla
            punch_info = getattr(a, "punch", None)
            status_info = getattr(a, "status", None)
            print(f"Ham veri: UserID={a.user_id}, Time={a.timestamp}, Status={status_info}, Punch={punch_info}, UID={getattr(a, 'uid', 'N/A')}")
            
            # Punch bilgisini analiz et
            is_entry = True  # Varsayılan olarak giriş
            if punch_info is not None:
                # Punch değeri 0 ise giriş, 1 ise çıkış olabilir (cihaza göre değişir)
                if punch_info == 1:
                    is_entry = False
                    print(f"Çıkış tespit edildi: {a.user_id} - {a.timestamp}")
                elif punch_info == 0:
                    print(f"Giriş tespit edildi: {a.user_id} - {a.timestamp}")
            else:
                # Punch bilgisi yoksa, zaman aralığına göre tahmin et
                hour = a.timestamp.hour
                if 6 <= hour <= 12:  # Sabah 6-12 arası muhtemelen giriş
                    is_entry = True
                    print(f"Sabah giriş tahmin edildi: {a.user_id} - {a.timestamp}")
                elif 16 <= hour <= 23:  # Akşam 16-23 arası muhtemelen çıkış
                    is_entry = False
                    print(f"Akşam çıkış tahmin edildi: {a.user_id} - {a.timestamp}")
                else:
                    # Gece yarısı ve erken sabah için varsayılan giriş
                    is_entry = True
                    print(f"Gece/erken sabah giriş tahmin edildi: {a.user_id} - {a.timestamp}")
            
            attendance_records.append({
                "user_id": a.user_id,
                "name": users.get(a.user_id, "Bilinmiyor"),
                "timestamp": a.timestamp,
                "device_uid": getattr(a, "uid", None),
                "status_code": status_info,
                "verify_method": punch_info,
                "is_entry": is_entry,  # Yeni alan
            })

        # Personel kayıtlarını cihazdan otomatik oluşturmak istenirse açın:
        # SYNC_AUTO_CREATE_PERSONEL=true iken aktif olur. Varsayılan: kapalı.
        if os.getenv("SYNC_AUTO_CREATE_PERSONEL", "false").lower() == "true":
            ensure_personel(users, attendance)

        save_to_supabase(attendance_records)
        
        # Cihazdaki verileri temizle (her sync'te)
        if os.getenv("SYNC_CLEAR_DEVICE_DATA", "false").lower() == "true":
            try:
                print("🧹 Cihazdaki veriler temizleniyor...")
                # Cihazdaki tüm attendance verilerini sil
                conn.clear_attendance()
                print("✅ Cihazdaki veriler başarıyla temizlendi")
            except Exception as clear_error:
                print(f"⚠️ Cihaz temizleme hatası: {clear_error}")
                print("Veriler Supabase'de güvende, devam ediliyor...")
        else:
            print("ℹ️ Cihaz temizleme kapalı (SYNC_CLEAR_DEVICE_DATA=false)")
        
        conn.disconnect()

        # Trigger otomatik olarak çalışacak, manuel işleme gerek yok
        print("Ham veriler kaydedildi. Trigger otomatik olarak giriş-çıkış çiftlerini oluşturacak.")

    except Exception as e:
        print("Hata:", e)

if __name__ == "__main__":
    main()
