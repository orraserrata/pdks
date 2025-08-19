-- Personel tablosuna aktif/pasif durumu ekle
ALTER TABLE personel 
ADD COLUMN IF NOT EXISTS aktif BOOLEAN DEFAULT true;

-- Mevcut kayıtları aktif yap
UPDATE personel 
SET aktif = true 
WHERE aktif IS NULL;

-- Aktif personelleri gösteren view oluştur
CREATE OR REPLACE VIEW aktif_personel AS
SELECT * FROM personel WHERE aktif = true;

-- Pasif personelleri gösteren view oluştur
CREATE OR REPLACE VIEW pasif_personel AS
SELECT * FROM personel WHERE aktif = false;

-- Test için mevcut durumu kontrol et
SELECT 
    COUNT(*) as toplam_personel,
    COUNT(CASE WHEN aktif = true THEN 1 END) as aktif_personel,
    COUNT(CASE WHEN aktif = false THEN 1 END) as pasif_personel
FROM personel;
