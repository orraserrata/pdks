from zk import ZK
from supabase import create_client, Client
from datetime import datetime, timedelta
import os

try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
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

        response = supabase.table("personel_giris_cikis").insert(record).execute()
        err = getattr(response, 'error', None)
        if err:
            print("Hata supabase insert:", err)
        else:
            print(f"Ham kayıt eklendi: {record}")


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


def generate_pairs(attendance):
    """Ardışık giriş-çıkış çiftlerini oluştur.

    Not: Çift üretimi gün sınırından bağımsızdır; ardışık iki kayıt bir çift kabul edilir.
    Ekran gösteriminde tarih/gün, iş günü başlangıcı kaydırması ile hesaplanır.
    """
    pairs = []
    attendance_by_user = {}

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
        attendance_by_user.setdefault(user, []).append(time_dt)

    for user, times in attendance_by_user.items():
        times.sort()
        for i in range(0, len(times), 2):
            giris = times[i]
            cikis = times[i + 1] if i + 1 < len(times) else None
            pairs.append({
                "kullanici_id": user,
                "giris_tarihi": giris.isoformat(sep=' '),
                "cikis_tarihi": cikis.isoformat(sep=' ') if cikis else None,
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
    payloads = []
    for uid_str, name in users_map.items():
        try:
            uid_int = int(uid_str)
        except Exception:
            continue
        isim, soyisim = _split_name(name)
        ise_giris = earliest_by_user.get(uid_int) or datetime.today().date().isoformat()
        payloads.append({
            "kullanici_id": uid_int,
            "isim": isim or "Bilinmiyor",
            "soyisim": soyisim or "",
            "ise_giris_tarihi": ise_giris,
        })

    if not payloads:
        return

    # Upsert ile var olanları güncellemeden atla (unique: kullanici_id)
    res = supabase.table("personel").upsert(payloads).execute()
    err = getattr(res, 'error', None)
    if err:
        print("Personel upsert hatası:", err)
    else:
        print(f"Personel upsert tamamlandı. {len(payloads)} kayıt denendi.")


def save_pairs(pairs):
    """Düzenli tabloya kaydet.
    Kural: Aynı kullanici_id + workday_date için tek satır olsun. Eğer mevcut satır admin_locked=true ise dokunma.
    Yoksa güncelle; mevcut yoksa ekle.
    Not: workday_date kolonu için SQL migration gerekir.
    """
    day_start_hour = int(os.getenv("SYNC_DAY_START_HOUR", "5"))

    def compute_workday(date_str: str) -> str:
        dt = datetime.fromisoformat(date_str)
        return (dt - timedelta(hours=day_start_hour)).date().isoformat()

    for p in pairs:
        workday = compute_workday(p["giris_tarihi"]) if p.get("giris_tarihi") else None
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
            }).eq("id", row["id"]).execute()
            if getattr(upd, 'error', None):
                print("Hata düzenli tablo update:", upd.error)
            else:
                print(f"Düzenli kayıt güncellendi: {p}")
        else:
            # Ekle
            insert_payload = dict(p)
            insert_payload["workday_date"] = workday
            res = supabase.table("personel_giris_cikis_duzenli").insert(insert_payload).execute()
            if getattr(res, 'error', None):
                print("Hata düzenli tablo insert:", res.error)
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
            attendance_records.append({
                "user_id": a.user_id,
                "name": users.get(a.user_id, "Bilinmiyor"),
                "timestamp": a.timestamp,
                "device_uid": getattr(a, "uid", None),
                "status_code": getattr(a, "status", None),
                "verify_method": getattr(a, "punch", None),
            })

        # Personel kayıtlarını cihazdan otomatik oluşturmak istenirse açın:
        # SYNC_AUTO_CREATE_PERSONEL=true iken aktif olur. Varsayılan: kapalı.
        if os.getenv("SYNC_AUTO_CREATE_PERSONEL", "false").lower() == "true":
            ensure_personel(users, attendance)

        save_to_supabase(attendance_records)
        conn.disconnect()

        # Ham veriyi alıp düzenle
        raw_data = get_raw_attendance()
        pairs = generate_pairs(raw_data)
        save_pairs(pairs)

    except Exception as e:
        print("Hata:", e)


if __name__ == "__main__":
    main()
