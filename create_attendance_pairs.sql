-- Ham verileri giriş-çıkış çiftlerine dönüştüren fonksiyon
CREATE OR REPLACE FUNCTION generate_attendance_pairs()
RETURNS void AS $$
BEGIN
    -- Önce mevcut düzenli kayıtları temizle (admin_locked=false olanları)
    DELETE FROM personel_giris_cikis_duzenli 
    WHERE admin_locked = false;
    
    -- Ham verileri giriş-çıkış çiftlerine dönüştür
    INSERT INTO personel_giris_cikis_duzenli (
        kullanici_id, 
        giris_tarihi, 
        cikis_tarihi, 
        workday_date, 
        admin_locked
    )
    WITH attendance_pairs AS (
        SELECT 
            pgc.kullanici_id,
            pgc.giris_tarihi,
            -- Bir sonraki kayıt çıkış olur
            LEAD(pgc.giris_tarihi) OVER (
                PARTITION BY pgc.kullanici_id, 
                CASE 
                    WHEN EXTRACT(HOUR FROM pgc.giris_tarihi) < 6 
                    THEN DATE(pgc.giris_tarihi) - INTERVAL '1 day'
                    ELSE DATE(pgc.giris_tarihi)
                END
                ORDER BY pgc.giris_tarihi
            ) as cikis_tarihi,
            -- İş günü hesaplama - 06:00'dan sonraki kayıtlar o günün, öncesi önceki günün
            CASE 
                WHEN EXTRACT(HOUR FROM pgc.giris_tarihi) < 6 
                THEN DATE(pgc.giris_tarihi) - INTERVAL '1 day'
                ELSE DATE(pgc.giris_tarihi)
            END as workday_date,
            -- Çift numarası (1, 2, 3...)
            ROW_NUMBER() OVER (
                PARTITION BY pgc.kullanici_id, 
                CASE 
                    WHEN EXTRACT(HOUR FROM pgc.giris_tarihi) < 6 
                    THEN DATE(pgc.giris_tarihi) - INTERVAL '1 day'
                    ELSE DATE(pgc.giris_tarihi)
                END
                ORDER BY pgc.giris_tarihi
            ) as pair_number
        FROM personel_giris_cikis pgc
        INNER JOIN personel p ON pgc.kullanici_id = p.kullanici_id
        WHERE p.aktif = true  -- Sadece aktif personeller
        ORDER BY pgc.kullanici_id, pgc.giris_tarihi
    )
    SELECT 
        kullanici_id,
        giris_tarihi,
        cikis_tarihi,
        workday_date,
        false as admin_locked
    FROM attendance_pairs
    WHERE pair_number % 2 = 1  -- Sadece tek numaralı kayıtlar (giriş)
    AND cikis_tarihi IS NOT NULL;  -- Çıkışı olan kayıtlar
    
    -- Tek kalan girişler (çıkışı olmayan)
    INSERT INTO personel_giris_cikis_duzenli (
        kullanici_id, 
        giris_tarihi, 
        cikis_tarihi, 
        workday_date, 
        admin_locked
    )
    WITH attendance_pairs AS (
        SELECT 
            pgc.kullanici_id,
            pgc.giris_tarihi,
            LEAD(pgc.giris_tarihi) OVER (
                PARTITION BY pgc.kullanici_id, 
                CASE 
                    WHEN EXTRACT(HOUR FROM pgc.giris_tarihi) < 6 
                    THEN DATE(pgc.giris_tarihi) - INTERVAL '1 day'
                    ELSE DATE(pgc.giris_tarihi)
                END
                ORDER BY pgc.giris_tarihi
            ) as cikis_tarihi,
            CASE 
                WHEN EXTRACT(HOUR FROM pgc.giris_tarihi) < 6 
                THEN DATE(pgc.giris_tarihi) - INTERVAL '1 day'
                ELSE DATE(pgc.giris_tarihi)
            END as workday_date,
            ROW_NUMBER() OVER (
                PARTITION BY pgc.kullanici_id, 
                CASE 
                    WHEN EXTRACT(HOUR FROM pgc.giris_tarihi) < 6 
                    THEN DATE(pgc.giris_tarihi) - INTERVAL '1 day'
                    ELSE DATE(pgc.giris_tarihi)
                END
                ORDER BY pgc.giris_tarihi
            ) as pair_number
        FROM personel_giris_cikis pgc
        INNER JOIN personel p ON pgc.kullanici_id = p.kullanici_id
        WHERE p.aktif = true  -- Sadece aktif personeller
        ORDER BY pgc.kullanici_id, pgc.giris_tarihi
    )
    SELECT 
        attendance_pairs.kullanici_id,
        attendance_pairs.giris_tarihi,
        NULL as cikis_tarihi,  -- Çıkış yok
        attendance_pairs.workday_date,
        false as admin_locked
    FROM attendance_pairs
    WHERE pair_number % 2 = 1  -- Tek numaralı kayıtlar
    AND cikis_tarihi IS NULL   -- Çıkışı olmayan kayıtlar
    AND pair_number = (  -- O günün son kaydı
        SELECT MAX(pair_number) 
        FROM attendance_pairs p2 
        WHERE p2.kullanici_id = attendance_pairs.kullanici_id 
        AND p2.workday_date = attendance_pairs.workday_date
    );
    
END;
$$ LANGUAGE plpgsql;

-- Fonksiyonu çalıştır
SELECT generate_attendance_pairs();

-- Sonuçları kontrol et
SELECT 
    kullanici_id,
    giris_tarihi,
    cikis_tarihi,
    workday_date,
    EXTRACT(EPOCH FROM (cikis_tarihi - giris_tarihi))/60 as sure_dakika
FROM personel_giris_cikis_duzenli 
WHERE admin_locked = false
ORDER BY kullanici_id, giris_tarihi;
