-- Aktif personeller için view'ları güncelle

-- personel_duzenli_with_names view'ını güncelle (sadece aktif personeller)
CREATE OR REPLACE VIEW personel_duzenli_with_names AS
SELECT 
    pgc.id,
    pgc.kullanici_id,
    p.isim,
    p.soyisim,
    pgc.giris_tarihi,
    pgc.cikis_tarihi,
    pgc.workday_date,
    pgc.admin_locked
FROM personel_giris_cikis_duzenli pgc
INNER JOIN personel p ON pgc.kullanici_id = p.kullanici_id
WHERE p.aktif = true  -- Sadece aktif personeller
ORDER BY pgc.giris_tarihi DESC;

-- Aktif personeller için özet view
CREATE OR REPLACE VIEW aktif_personel_ozet AS
SELECT 
    p.kullanici_id,
    p.isim,
    p.soyisim,
    p.ise_giris_tarihi,
    COUNT(pgc.id) as toplam_kayit,
    SUM(CASE WHEN pgc.cikis_tarihi IS NOT NULL THEN 1 ELSE 0 END) as tamamlanmis_kayit,
    SUM(CASE WHEN pgc.cikis_tarihi IS NULL THEN 1 ELSE 0 END) as acik_kayit
FROM personel p
LEFT JOIN personel_giris_cikis_duzenli pgc ON p.kullanici_id = pgc.kullanici_id
WHERE p.aktif = true  -- Sadece aktif personeller
GROUP BY p.kullanici_id, p.isim, p.soyisim, p.ise_giris_tarihi
ORDER BY p.isim;

-- Test için view'ları kontrol et
SELECT 'personel_duzenli_with_names' as view_name, COUNT(*) as kayit_sayisi 
FROM personel_duzenli_with_names
UNION ALL
SELECT 'aktif_personel_ozet' as view_name, COUNT(*) as kayit_sayisi 
FROM aktif_personel_ozet;
