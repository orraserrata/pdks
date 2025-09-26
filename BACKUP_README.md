# 🗄️ Database Yedekleme Rehberi

## 📋 Yedekleme Yöntemleri

### 1. **Python Script ile Otomatik Yedekleme (Önerilen)**

```bash
# Yedek al
python backup_database.py backup

# Yedekleri listele
python backup_database.py list

# Yedekten geri yükle
python backup_database.py restore backup_20241225_143022
```

### 2. **Supabase Dashboard'dan Manuel Yedekleme**

1. **Supabase Dashboard** → **Settings** → **Database**
2. **Backups** sekmesine git
3. **Download backup** butonuna tıkla
4. SQL dump dosyasını indir

### 3. **pg_dump ile Komut Satırından**

```bash
# Yedek al
pg_dump -h db.adpopdmavlseifoxpobo.supabase.co \
        -U postgres \
        -d postgres \
        -f backup_$(date +%Y%m%d_%H%M%S).sql

# Geri yükle
psql -h db.adpopdmavlseifoxpobo.supabase.co \
     -U postgres \
     -d postgres \
     -f backup_20241225_143022.sql
```

## 🚨 Önemli Notlar

### ⚠️ Yedekleme Öncesi
- **SERVICE_KEY** gerekli (admin yetkisi)
- `.env` dosyasında `SUPABASE_SERVICE_KEY` tanımlı olmalı
- Yeterli disk alanı olduğundan emin ol

### 🔒 Güvenlik
- Yedek dosyaları güvenli yerde sakla
- SERVICE_KEY'i kimseyle paylaşma
- Yedekleri şifrele (opsiyonel)

### 📊 Yedek İçeriği
- **personel**: Tüm personel bilgileri
- **personel_giris_cikis**: Ham giriş-çıkış verileri
- **personel_giris_cikis_duzenli**: İşlenmiş giriş-çıkış verileri
- **maas_ayarlari**: Maaş ayarları
- **kullanici_profilleri**: Kullanıcı profilleri
- **admin_users**: Admin kullanıcıları
- **hata_bildirimleri**: Hata bildirimleri

## 🔄 Geri Yükleme Adımları

### 1. **Python Script ile**
```bash
python backup_database.py restore backup_20241225_143022
```

### 2. **Manuel Geri Yükleme**
1. Supabase Dashboard → **SQL Editor**
2. Yedek SQL dosyasını yükle
3. **Run** butonuna tıkla

### 3. **Dikkat Edilecekler**
- Geri yükleme öncesi mevcut veriler silinebilir
- RLS politikaları yeniden oluşturulabilir
- Trigger'lar yeniden kurulabilir

## 📅 Otomatik Yedekleme (Opsiyonel)

### Windows Task Scheduler
```bash
# Günlük yedekleme
schtasks /create /tn "DB Backup" /tr "python C:\path\to\backup_database.py backup" /sc daily /st 02:00
```

### Linux Cron
```bash
# Günlük yedekleme (gece 2'de)
0 2 * * * cd /path/to/project && python backup_database.py backup
```

## 🆘 Acil Durum Senaryoları

### Veri Kaybı Durumunda
1. **Son yedeği bul**: `python backup_database.py list`
2. **Geri yükle**: `python backup_database.py restore backup_XXXXXX`
3. **Kontrol et**: Verilerin doğru yüklendiğini kontrol et

### Yedek Bulunamazsa
1. **Supabase Dashboard** → **Database** → **Backups**
2. **Point-in-time recovery** kullan
3. **Manual SQL export** yap

## 📞 Destek

Sorun yaşarsanız:
1. Hata mesajını kaydet
2. Yedek dosyalarının varlığını kontrol et
3. Supabase Dashboard'dan manuel yedekleme dene

