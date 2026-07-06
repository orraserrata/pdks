-- Maaş ayarı olmayan tüm personel için varsayılan kayıt oluşturur.
-- Supabase SQL Editor'da çalıştırın (backfill_maas_ayarlari.py alternatifi).

INSERT INTO maas_ayarlari (kullanici_id, aylik_maas, hedef_saat, aktif)
SELECT p.kullanici_id, 0, 240, COALESCE(p.aktif, true)
FROM personel p
WHERE NOT EXISTS (
  SELECT 1 FROM maas_ayarlari m WHERE m.kullanici_id = p.kullanici_id
);
