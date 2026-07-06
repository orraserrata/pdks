-- Personel tablosuna maaş tipi alanı ekler.
-- Varsayılan: saatli (mevcut tüm kayıtlar saatli maaş alan olarak işaretlenir)
-- Supabase SQL Editor'da çalıştırın.

ALTER TABLE personel
  ADD COLUMN IF NOT EXISTS maas_tipi text NOT NULL DEFAULT 'saatli';

ALTER TABLE personel
  DROP CONSTRAINT IF EXISTS personel_maas_tipi_check;

ALTER TABLE personel
  ADD CONSTRAINT personel_maas_tipi_check
  CHECK (maas_tipi IN ('saatli', 'gunluk'));

COMMENT ON COLUMN personel.maas_tipi IS 'Maaş hesaplama tipi: saatli veya gunluk';
