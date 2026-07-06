-- Eski izin talepleri bitiş tarihini 1 gün geri alır (tek seferlik migrasyon).
-- Eski sistem bitişi eksklüsif sayıyordu; kullanıcılar son izin gününün ertesi gününü giriyordu.
-- Yeni sistem bitişi dahil saydığı için mevcut kayıtlar düzeltilir.
-- Bu scripti bir kez çalıştırın. Sonradan girilen talepler etkilenmez.
-- Supabase SQL Editor'da çalıştırın.

ALTER TABLE izin_talepleri
  ADD COLUMN IF NOT EXISTS bitis_inclusive_migrated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN izin_talepleri.bitis_inclusive_migrated IS
  'true: bitis_tarihi dahil mantığına göre girilmiş veya migrasyon uygulanmış kayıt';

UPDATE izin_talepleri
SET
  bitis_tarihi = (bitis_tarihi::date - interval '1 day')::date,
  bitis_inclusive_migrated = true
WHERE bitis_inclusive_migrated = false
  AND bitis_tarihi::date > baslangic_tarihi::date;

-- Kontrol (opsiyonel): kaç kayıt güncellendi
-- SELECT COUNT(*) FROM izin_talepleri WHERE bitis_inclusive_migrated = true;
