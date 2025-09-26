# 🧹 Haftalık Cihaz Temizleme Sistemi

## 📋 Özellikler

### ✅ Haftalık Otomatik Temizleme
- **Varsayılan**: Her Pazartesi temizleme yapılır
- **Özelleştirilebilir**: Hangi gün temizleneceği ayarlanabilir
- **Güvenli**: Veriler Supabase'de güvende
- **Akıllı**: Sadece 7 gün geçmişse temizler

## ⚙️ Kurulum

### 1. **Dosyaları Güncelleyin**
- `src/sync.py` dosyasını güncelleyin
- `.env` dosyasına aşağıdaki satırları ekleyin:

```env
# Haftalık cihaz temizleme (true/false)
SYNC_CLEAR_DEVICE_DATA=true

# Temizleme günü (0=Pazartesi, 1=Salı, ..., 6=Pazar)
SYNC_CLEAR_DAY=0
```

### 2. **Gün Seçenekleri**
```
0 = Pazartesi
1 = Salı  
2 = Çarşamba
3 = Perşembe
4 = Cuma
5 = Cumartesi
6 = Pazar
```

## 🔄 Nasıl Çalışır

### 📅 Haftalık Döngü
1. **Her sync çalıştığında** gün kontrolü yapılır
2. **Eğer bugün temizleme günüyse** ve **7 gün geçmişse** temizler
3. **Temizleme sonrası** tarih güncellenir
4. **Sonraki 7 gün** temizleme yapılmaz

### 📁 Dosya Sistemi
- `last_clear_date.json` - Son temizleme tarihini saklar
- Otomatik oluşturulur, manuel müdahale gerekmez

## 🚀 Kullanım

### Normal Çalıştırma
```bash
# Tek seferlik
python src/sync.py

# Sürekli çalıştırma
python sync_loop.py
```

### Manuel Temizleme
Eğer manuel temizleme yapmak isterseniz:
```bash
# last_clear_date.json dosyasını silin
rm last_clear_date.json

# Sonra sync.py çalıştırın
python src/sync.py
```

## 📊 Log Örnekleri

### Normal Gün (Temizleme Yok)
```
ℹ️ Haftalık temizleme zamanı henüz gelmedi
```

### Temizleme Günü
```
🧹 Haftalık cihaz temizleme başlatılıyor...
✅ Cihazdaki veriler başarıyla temizlendi
Son temizleme tarihi güncellendi: 2024-09-12 14:30:15
```

### İlk Temizleme
```
İlk kez temizleme yapılacak
🧹 Haftalık cihaz temizleme başlatılıyor...
✅ Cihazdaki veriler başarıyla temizlendi
```

## ⚠️ Önemli Notlar

### 🛡️ Güvenlik
- **Veriler güvende**: Tüm veriler Supabase'de saklanır
- **Geri dönüş**: Temizleme sonrası veriler kaybolmaz
- **Hata durumu**: Temizleme başarısız olsa bile sync devam eder

### 🔧 Ayarlar
- **SYNC_CLEAR_DEVICE_DATA=false** yaparsanız temizleme tamamen kapanır
- **SYNC_CLEAR_DAY** değiştirerek temizleme gününü ayarlayabilirsiniz
- **last_clear_date.json** dosyasını silerek manuel temizleme yapabilirsiniz

### 📈 Avantajlar
- **Cihaz performansı**: Cihazda veri birikmez
- **Otomatik**: Manuel müdahale gerektirmez
- **Esnek**: Gün ve sıklık ayarlanabilir
- **Güvenli**: Veri kaybı riski yok

## 🆘 Sorun Giderme

### Temizleme Çalışmıyor
1. `.env` dosyasında `SYNC_CLEAR_DEVICE_DATA=true` olduğundan emin olun
2. Bugünün temizleme günü olduğunu kontrol edin
3. `last_clear_date.json` dosyasını silin ve tekrar deneyin

### Hata Mesajları
- **"Cihaz temizleme hatası"**: Cihaz bağlantı sorunu, veriler güvende
- **"Son temizleme tarihi okunamadı"**: Dosya izin sorunu, normal çalışır
- **"Son temizleme tarihi güncellenemedi"**: Dosya yazma sorunu, normal çalışır

## 📞 Destek

Sorun yaşarsanız:
1. Log mesajlarını kontrol edin
2. `.env` ayarlarını doğrulayın
3. `last_clear_date.json` dosyasını silin
4. Manuel temizleme yapın

