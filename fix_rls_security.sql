-- RLS Güvenlik Düzeltmeleri
-- Bu script RLS kapalı olan tabloları aktif eder

-- 1. kullanici_profilleri tablosunda RLS'yi aktif et
ALTER TABLE kullanici_profilleri ENABLE ROW LEVEL SECURITY;

-- 2. maas_ayarlari tablosunda RLS'yi aktif et  
ALTER TABLE maas_ayarlari ENABLE ROW LEVEL SECURITY;

-- 3. Mevcut politikaları kontrol et
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('kullanici_profilleri', 'maas_ayarlari')
ORDER BY tablename, policyname;

-- 4. RLS durumunu tekrar kontrol et
SELECT 
    t.tablename,
    t.rowsecurity as rls_enabled,
    COUNT(p.policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
AND t.tablename IN ('kullanici_profilleri', 'maas_ayarlari')
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

