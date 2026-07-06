-- Merkezi maaş hedef ayarları (tüm saatlik / günlük personel için tek kaynak)
-- Supabase SQL Editor'da çalıştırın.

CREATE TABLE IF NOT EXISTS maas_hedef_ayarlari (
  maas_tipi text PRIMARY KEY CHECK (maas_tipi IN ('saatli', 'gunluk')),
  hedef_deger integer NOT NULL CHECK (hedef_deger > 0),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO maas_hedef_ayarlari (maas_tipi, hedef_deger) VALUES
  ('saatli', 240),
  ('gunluk', 22)
ON CONFLICT (maas_tipi) DO NOTHING;

ALTER TABLE maas_hedef_ayarlari ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE maas_hedef_ayarlari IS 'Tüm personel için merkezi hedef saat/gün ayarları';
COMMENT ON COLUMN maas_hedef_ayarlari.hedef_deger IS 'saatli: hedef saat, gunluk: hedef gün';
