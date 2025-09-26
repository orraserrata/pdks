# 🚀 PDKS Sync Servis Kurulumu

## 📋 Gereksinimler

### Python Kütüphaneleri
```bash
pip install pywin32
pip install pyzk
pip install supabase
pip install python-dotenv
```

## 🔧 Servis Kurulumu

### 1. **Manuel Servis Kurulumu (Önerilen)**

#### A. Servis Oluşturma
```bash
# Yönetici olarak PowerShell açın
sc create "PDKSSyncService" binPath="python C:\path\to\your\project\sync_loop.py" start=auto
```

#### B. Servis Başlatma
```bash
sc start PDKSSyncService
```

#### C. Servis Durumu Kontrol
```bash
sc query PDKSSyncService
```

### 2. **Otomatik Servis Kurulumu**

#### A. Servis Kurulumu
```bash
# Yönetici olarak çalıştırın
python install_service.py install
```

#### B. Servis Başlatma
```bash
python install_service.py start
```

#### C. Servis Durdurma
```bash
python install_service.py stop
```

#### D. Servis Kaldırma
```bash
python install_service.py remove
```

## 🔍 Sorun Giderme

### 1. **Servis Çalışmıyor**
```bash
# Log dosyasını kontrol edin
type logs\sync.log

# Servis durumunu kontrol edin
sc query PDKSSyncService
```

### 2. **Çalışma Dizini Sorunu**
- `sync_loop.py` dosyası güncellenmiş halde olmalı
- Proje dizininde `.env` dosyası olmalı

### 3. **Environment Değişkenleri**
- `.env` dosyasında `SYNC_CLEAR_DEVICE_DATA=true` olmalı
- Supabase anahtarları doğru olmalı

### 4. **Cihaz Bağlantısı**
- Cihaz IP adresi: `192.168.0.139`
- Cihaz açık ve erişilebilir olmalı

## 📁 Dosya Yapısı

```
project/
├── src/
│   └── sync.py
├── sync_loop.py
├── install_service.py
├── .env
└── logs/
    └── sync.log
```

## ⚙️ Servis Ayarları

### Servis Özellikleri
- **Ad**: PDKSSyncService
- **Açıklama**: PDKS cihazından veri senkronizasyonu
- **Başlangıç**: Otomatik
- **Çalışma Süresi**: 5 dakikada bir

### Log Dosyaları
- **Servis Log**: `logs/service.log`
- **Sync Log**: `logs/sync.log`

## 🆘 Acil Durum

### Servis Durdurma
```bash
sc stop PDKSSyncService
```

### Manuel Çalıştırma
```bash
python sync_loop.py
```

### Log Temizleme
```bash
del logs\*.log
```

## 📞 Destek

Sorun yaşarsanız:
1. Log dosyalarını kontrol edin
2. Servis durumunu kontrol edin
3. Manuel çalıştırmayı deneyin
4. Environment değişkenlerini kontrol edin


