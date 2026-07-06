-- get_personel_leave_summary RPC: calisma_tipi alanını ekler.
-- add_calisma_tipi.sql çalıştırıldıktan sonra Supabase SQL Editor'da çalıştırın.
--
-- Dönüş tipi değiştiği için önce mevcut fonksiyon silinir.

DROP FUNCTION IF EXISTS get_personel_leave_summary();

CREATE FUNCTION get_personel_leave_summary()
RETURNS TABLE (
  kullanici_id integer,
  isim text,
  soyisim text,
  ise_giris_tarihi date,
  aktif boolean,
  calisma_tipi text,
  manuel_hakedilen_izin integer,
  manuel_kullanilan_izin integer,
  devreden_yillik_izin integer,
  used_leave numeric,
  total_working_days bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    p.kullanici_id,
    p.isim,
    p.soyisim,
    p.ise_giris_tarihi,
    p.aktif,
    COALESCE(p.calisma_tipi, 'full_time') AS calisma_tipi,
    COALESCE(p.manuel_hakedilen_izin, 0) AS manuel_hakedilen_izin,
    COALESCE(p.manuel_kullanilan_izin, 0) AS manuel_kullanilan_izin,
    COALESCE(p.devreden_yillik_izin, 0) AS devreden_yillik_izin,
    COALESCE(izin.used_leave, 0) AS used_leave,
    COALESCE(att.total_working_days, 0) AS total_working_days
  FROM personel p
  LEFT JOIN LATERAL (
    SELECT SUM(
      GREATEST(0, (t.bitis_tarihi::date - t.baslangic_tarihi::date))
    ) AS used_leave
    FROM izin_talepleri t
    WHERE t.kullanici_id = p.kullanici_id
      AND t.durum = 'onaylandi'
      AND t.izin_tipi = 'yillik_izin'
  ) izin ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT COALESCE(
      g.workday_date::text,
      split_part(g.giris_tarihi::text, 'T', 1)
    )) AS total_working_days
    FROM personel_giris_cikis_duzenli g
    WHERE g.kullanici_id = p.kullanici_id
  ) att ON true
  ORDER BY p.isim, p.soyisim;
$$;
