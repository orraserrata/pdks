-- Admin yetkisi verme fonksiyonu
-- Bu fonksiyonu sadece admin olan kişiler çalıştırabilir

-- Belirli bir kullanıcıya admin yetkisi ver
UPDATE kullanici_profilleri 
SET is_admin = true 
WHERE email = 'admin@example.com'; -- Buraya admin yapmak istediğiniz e-posta adresini yazın

-- Tüm kullanıcıların admin durumunu kontrol et
SELECT 
    email,
    isim,
    soyisim,
    is_admin,
    created_at
FROM kullanici_profilleri 
ORDER BY created_at DESC;

-- Admin yetkisini kaldır (gerekirse)
-- UPDATE kullanici_profilleri 
-- SET is_admin = false 
-- WHERE email = 'user@example.com';

-- Yeni oluşturulan hesapların admin olmadığını doğrula
SELECT 
    'Yeni hesaplar admin değil' as durum,
    COUNT(*) as sayi
FROM kullanici_profilleri 
WHERE is_admin = false
UNION ALL
SELECT 
    'Admin hesaplar' as durum,
    COUNT(*) as sayi
FROM kullanici_profilleri 
WHERE is_admin = true;
