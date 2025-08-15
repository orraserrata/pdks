from supabase import create_client
from datetime import datetime

SUPABASE_URL = "https://adpopdmavlseifoxpobo.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcG9wZG1hdmxzZWlmb3hwb2JvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5ODQ2MjMsImV4cCI6MjA3MDU2MDYyM30.Sv1EK6_IC12bO7vNtB2vY9R-H2ot5x0Rg0XmCWgmdVM"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_raw_attendance():
    """Ham giriş verilerini al"""
    result = supabase.table('personel_giris_cikis') \
        .select('kullanici_id,giris_tarihi') \
        .order('giris_tarihi', desc=False) \
        .execute()
    
    if hasattr(result, 'error') and result.error:
        print("Hata:", result.error)
        return []
    
    return getattr(result, 'data', [])

def generate_pairs(attendance):
    """Ardışık giriş-çıkış çiftlerini oluştur"""
    pairs = []
    attendance_by_user = {}

    # Kullanıcı bazında grupla
    for row in attendance:
        user = row['kullanici_id']
        time_str = row['giris_tarihi']
        # string -> datetime
        time = datetime.fromisoformat(time_str)
        attendance_by_user.setdefault(user, []).append(time)

    # Her kullanıcı için ardışık çift oluştur
    for user, times in attendance_by_user.items():
        times.sort()  # Tarihe göre sırala
        for i in range(0, len(times)-1, 2):  # iki iki atla
            giris = times[i]
            cikis = times[i+1] if i+1 < len(times) else None
            pairs.append({
                'kullanici_id': user,
                'giris_tarihi': giris.isoformat(),
                'cikis_tarihi': cikis.isoformat() if cikis else None
            })
    return pairs

def save_pairs(pairs):
    for p in pairs:
        # Aynı kullanıcı ve giriş zamanı olan kayıt var mı diye kontrol
        check = supabase.table('personel_giris_cikis_duzenli') \
            .select('id') \
            .eq('kullanici_id', p['kullanici_id']) \
            .eq('giris_tarihi', p['giris_tarihi']) \
            .execute()
        
        if check.data and len(check.data) > 0:
            print("Zaten var, atlandı:", p)
            continue  # Aynı kayıt varsa ekleme
        
        # Kayıt yoksa ekle
        res = supabase.table('personel_giris_cikis_duzenli').insert(p).execute()
        if res.error:
            print("Hata:", res.error)
        else:
            print("Kayıt eklendi:", p)


if __name__ == "__main__":
    raw_data = get_raw_attendance()
    if not raw_data:
        print("Veri bulunamadı.")
    else:
        pairs = generate_pairs(raw_data)
        save_pairs(pairs)
