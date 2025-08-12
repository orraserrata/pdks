from zk import ZK
from supabase import create_client, Client

# Supabase bilgilerin
SUPABASE_URL = "https://adpopdmavlseifoxpobo.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcG9wZG1hdmxzZWlmb3hwb2JvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5ODQ2MjMsImV4cCI6MjA3MDU2MDYyM30.Sv1EK6_IC12bO7vNtB2vY9R-H2ot5x0Rg0XmCWgmdVM"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def save_to_supabase(records):
    for rec in records:
        user_id = rec.user_id
        timestamp = rec.timestamp.strftime("%Y-%m-%d %H:%M:%S")

        record = {
            "kullanici_id": user_id,
            "giris_tarihi": timestamp,
        }

        response = supabase.table("personel_giris_cikis").insert(record).execute()

        # Daha sağlam kontrol
        if hasattr(response, 'error') and response.error:
            print("Hata supabase insert:", response.error)
        else:
            print(f"Kayıt eklendi: {record}")


def main():
    zk = ZK('192.168.0.139', port=4370)
    try:
        conn = zk.connect()
        attendance = conn.get_attendance()
        save_to_supabase(attendance)
        conn.disconnect()
    except Exception as e:
        print("Hata:", e)

if __name__ == "__main__":
    main()
