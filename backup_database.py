import os
import json
import csv
from datetime import datetime
from supabase import create_client, Client

# .env dosyasını yükle
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("⚠️ python-dotenv yüklü değil. Environment değişkenlerini manuel olarak ayarlayın.")

# Supabase bağlantı bilgileri
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('REACT_APP_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

def create_backup():
    """Database'in tam yedeğini al"""
    print("🗄️ Database yedeği alınıyor...")
    
    # Supabase client oluştur
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    # Yedek klasörü oluştur
    backup_dir = f"backups/backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    os.makedirs(backup_dir, exist_ok=True)
    
    # Tüm tabloları yedekle
    tables_to_backup = [
        'personel',
        'personel_giris_cikis',
        'personel_giris_cikis_duzenli',
        'maas_ayarlari',
        'kullanici_profilleri',
        'admin_users',
        'hata_bildirimleri'
    ]
    
    backup_data = {}
    
    for table in tables_to_backup:
        try:
            print(f"📋 {table} tablosu yedekleniyor...")
            
            # Tabloyu çek
            response = supabase.table(table).select('*').execute()
            
            if response.data:
                backup_data[table] = response.data
                
                # CSV olarak da kaydet
                csv_path = f"{backup_dir}/{table}.csv"
                if response.data:
                    with open(csv_path, 'w', newline='', encoding='utf-8-sig') as csvfile:
                        fieldnames = response.data[0].keys()
                        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                        writer.writeheader()
                        writer.writerows(response.data)
                print(f"✅ {table}: {len(response.data)} kayıt -> {csv_path}")
            else:
                print(f"⚠️ {table}: Veri bulunamadı")
                
        except Exception as e:
            print(f"❌ {table} yedekleme hatası: {e}")
    
    # JSON olarak da kaydet
    json_path = f"{backup_dir}/full_backup.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(backup_data, f, ensure_ascii=False, indent=2, default=str)
    
    print(f"\n🎉 Yedekleme tamamlandı!")
    print(f"📁 Klasör: {backup_dir}")
    print(f"📄 JSON: {json_path}")
    print(f"📊 Toplam tablo: {len(backup_data)}")
    
    # Özet bilgi
    total_records = sum(len(data) for data in backup_data.values())
    print(f"📈 Toplam kayıt: {total_records}")
    
    return backup_dir

def restore_backup(backup_dir):
    """Yedekten geri yükle"""
    print(f"🔄 {backup_dir} yedeğinden geri yükleniyor...")
    
    # Supabase client oluştur
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    json_path = f"{backup_dir}/full_backup.json"
    
    if not os.path.exists(json_path):
        print(f"❌ Yedek dosyası bulunamadı: {json_path}")
        return
    
    # JSON'u oku
    with open(json_path, 'r', encoding='utf-8') as f:
        backup_data = json.load(f)
    
    # Tabloları geri yükle
    for table, data in backup_data.items():
        if not data:
            continue
            
        try:
            print(f"📋 {table} tablosu geri yükleniyor...")
            
            # Mevcut verileri temizle (dikkatli ol!)
            # supabase.table(table).delete().neq('id', 0).execute()
            
            # Yeni verileri ekle
            for record in data:
                supabase.table(table).insert(record).execute()
            
            print(f"✅ {table}: {len(data)} kayıt geri yüklendi")
            
        except Exception as e:
            print(f"❌ {table} geri yükleme hatası: {e}")

def list_backups():
    """Mevcut yedekleri listele"""
    if not os.path.exists('backups'):
        print("📁 Henüz yedek bulunmuyor")
        return
    
    backups = [d for d in os.listdir('backups') if d.startswith('backup_')]
    backups.sort(reverse=True)
    
    print("📋 Mevcut yedekler:")
    for i, backup in enumerate(backups, 1):
        backup_path = f"backups/{backup}"
        if os.path.exists(f"{backup_path}/full_backup.json"):
            size = os.path.getsize(f"{backup_path}/full_backup.json")
            print(f"{i}. {backup} ({size/1024:.1f} KB)")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "backup":
            create_backup()
        elif command == "list":
            list_backups()
        elif command == "restore" and len(sys.argv) > 2:
            backup_name = sys.argv[2]
            restore_backup(f"backups/{backup_name}")
        else:
            print("Kullanım:")
            print("python backup_database.py backup     # Yedek al")
            print("python backup_database.py list       # Yedekleri listele")
            print("python backup_database.py restore backup_20241225_143022  # Yedekten geri yükle")
    else:
        print("🗄️ Database Yedekleme Aracı")
        print("=" * 40)
        print("1. Yedek al")
        print("2. Yedekleri listele")
        print("3. Yedekten geri yükle")
        
        choice = input("\nSeçiminiz (1-3): ")
        
        if choice == "1":
            create_backup()
        elif choice == "2":
            list_backups()
        elif choice == "3":
            list_backups()
            backup_name = input("\nGeri yüklenecek yedek adını girin: ")
            if backup_name:
                restore_backup(f"backups/{backup_name}")
        else:
            print("Geçersiz seçim!")
