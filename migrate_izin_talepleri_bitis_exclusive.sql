-- Dahil bitiş mantığına göre girilmiş kayıtları eksklüsif formata çevirir (tek seferlik).
-- bitis_tarihi 1 gün ileri alınır; bitiş günü artık sayılmaz, başlangıç dahil kalır.
-- migrate_izin_talepleri_bitis.sql çalıştırılmış olabilir; bu script mevcut tüm
-- bitis_inclusive_migrated = true kayıtlarını düzeltir.
-- Supabase SQL Editor'da bir kez çalıştırın.

UPDATE izin_talepleri
SET
  bitis_tarihi = (bitis_tarihi::date + interval '1 day')::date,
  bitis_inclusive_migrated = false
WHERE bitis_inclusive_migrated = true;

-- Dahil formatta girilmiş ama flag atanmamış olabilecek kayıtlar (bitis = baslangic)
UPDATE izin_talepleri
SET
  bitis_tarihi = (bitis_tarihi::date + interval '1 day')::date
WHERE bitis_inclusive_migrated = false
  AND bitis_tarihi::date = baslangic_tarihi::date;
