-- Personel tablosuna çalışma tipi (tam zamanlı / yarı zamanlı) alanı ekler.
-- Varsayılan: full_time (mevcut tüm kayıtlar tam zamanlı)
-- Supabase SQL Editor'da çalıştırın.

ALTER TABLE personel
  ADD COLUMN IF NOT EXISTS calisma_tipi text NOT NULL DEFAULT 'full_time';

ALTER TABLE personel
  DROP CONSTRAINT IF EXISTS personel_calisma_tipi_check;

ALTER TABLE personel
  ADD CONSTRAINT personel_calisma_tipi_check
  CHECK (calisma_tipi IN ('full_time', 'part_time'));

COMMENT ON COLUMN personel.calisma_tipi IS 'Çalışma tipi: full_time (tam zamanlı) veya part_time (yarı zamanlı)';
