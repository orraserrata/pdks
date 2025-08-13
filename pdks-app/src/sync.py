from zk import ZK
from supabase import create_client, Client
from datetime import datetime

# Supabase bilgilerin
SUPABASE_URL = "https://adpopdmavlseifoxpobo.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcG9wZG1hdmxzZWlmb3hwb2JvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5ODQ2MjMsImV4cCI6MjA3MDU2MDYyM30.Sv1EK6_IC12bO7vNtB2vY9R-H2ot5x0Rg0XmCWgmdVM"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def record_exists(table, user_id, timestamp):
    """Belirli kayıt var mı kontrol et"""
    result = supabase.table(table).select("*").eq("kullanici_id", user_id).eq("giris_tarihi", timestamp).execute()
    return bool(result.data)


def save_to_supabase(records):
    """Ham veriyi supabase'e kaydet"""
    for rec in records:
        user_id = rec["user_id"]
        name = rec["name"]
        timestamp = rec["timestamp"].strftime("%Y-%m-%d %H:%M:%S")
        
        if record_exists("personel_giris_cikis", user_id, timestamp):
            print(f"Zaten var, eklenmedi: {user_id} - {timestamp}")
            continue

        record = {
            "kullanici_id": user_id,
            "isim": name,
            "giris_tarihi": timestamp,
        }

        response = supabase.table("personel_giris_cikis").insert(record).execute()
        if hasattr(response, 'error') and response.error:
            print("Hata supabase insert:", response.error)
        else:
            print(f"Ham kayıt eklendi: {record}")


def get_raw_attendance():
    """Ham tabloyu al"""
    result = supabase.table("personel_giris_cikis").select("kullanici_id,giris_tarihi").execute()
    if result.error:
        print("Hata supabase select:", result.error)
        return []
    return result.data


def generate_pairs(attendance):
    """Ardışık giriş-çıkış çiftlerini oluştur"""
    pairs = []
    attendance_by_user = {}

    for row in attendance:
        user = row['kullanici_id']
        time = row['giris_tarihi']
        attendance_by_user.setdefault(user, []).append(time)

    for user, times in attendance_by_user.items():
        times.sort()
        for i in range(0, len(times)-1, 2):
            giris = times[i]
            cikis = times[i+1] if i+1 < len(times) else None
            pairs.append({
                "kullanici_id": user,
                "giris_tarihi": giris,
                "cikis_tarihi": cikis
            })
    return pairs


def save_pairs(pairs):
    """Düzenli tabloya kaydet, duplicate olmasın"""
    for p in pairs:
        if record_exists("personel_giris_cikis_duzenli", p["kullanici_id"], p["giris_tarihi"]):
            print(f"Düzenli kayıt zaten var, eklenmedi: {p}")
            continue

        res = supabase.table("personel_giris_cikis_duzenli").insert(p).execute()
        if hasattr(res, 'error') and res.error:
            print("Hata düzenli tablo insert:", res.error)
        else:
            print(f"Düzenli kayıt eklendi: {p}")


def main():
    zk = ZK('192.168.0.139', port=4370)
    try:
        conn = zk.connect()

        # Kullanıcı ID -> isim eşlemesi
        users = {user.user_id: user.name for user in conn.get_users()}
        attendance = conn.get_attendance()

         # ID → isim ekle
        attendance_records = []
        for a in attendance:
            attendance_records.append({
                "user_id": a.user_id,
                "name": users.get(a.user_id, "Bilinmiyor"),
                "timestamp": a.timestamp
            })

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
