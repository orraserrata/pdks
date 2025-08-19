-- Otomatik güncelleme için trigger oluştur
CREATE OR REPLACE FUNCTION trigger_generate_pairs()
RETURNS TRIGGER AS $$
BEGIN
    -- Yeni veri eklendiğinde otomatik olarak çiftleri güncelle
    PERFORM generate_attendance_pairs();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı personel_giris_cikis tablosuna bağla
DROP TRIGGER IF EXISTS auto_generate_pairs ON personel_giris_cikis;

CREATE TRIGGER auto_generate_pairs
    AFTER INSERT ON personel_giris_cikis
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_pairs();

-- Test için trigger'ın çalışıp çalışmadığını kontrol et
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'auto_generate_pairs';
