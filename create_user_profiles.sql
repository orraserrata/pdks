-- Kullanıcı profilleri tablosu oluştur
CREATE TABLE IF NOT EXISTS kullanici_profilleri (
    id SERIAL PRIMARY KEY,
    kullanici_id INTEGER NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    isim TEXT,
    soyisim TEXT,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Personel tablosu ile foreign key ilişkisi
ALTER TABLE kullanici_profilleri 
ADD CONSTRAINT fk_kullanici_profilleri_personel 
FOREIGN KEY (kullanici_id) REFERENCES personel(kullanici_id) ON DELETE CASCADE;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_kullanici_profilleri_email ON kullanici_profilleri(email);
CREATE INDEX IF NOT EXISTS idx_kullanici_profilleri_kullanici_id ON kullanici_profilleri(kullanici_id);
CREATE INDEX IF NOT EXISTS idx_kullanici_profilleri_is_admin ON kullanici_profilleri(is_admin);

-- RLS (Row Level Security) politikaları
ALTER TABLE kullanici_profilleri ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar sadece kendi profillerini görebilir
CREATE POLICY "Kullanıcılar kendi profillerini görebilir" ON kullanici_profilleri
    FOR SELECT USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'kullanici_id' = kullanici_id::text
        )
    );

-- Adminler tüm profilleri görebilir
CREATE POLICY "Adminler tüm profilleri görebilir" ON kullanici_profilleri
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM kullanici_profilleri 
            WHERE auth.uid() IN (
                SELECT id FROM auth.users 
                WHERE raw_user_meta_data->>'kullanici_id' = kullanici_id::text
            ) AND is_admin = true
        )
    );

-- Kullanıcılar kendi profillerini güncelleyebilir
CREATE POLICY "Kullanıcılar kendi profillerini güncelleyebilir" ON kullanici_profilleri
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'kullanici_id' = kullanici_id::text
        )
    );

-- Test için mevcut durumu kontrol et
SELECT 
    'kullanici_profilleri' as table_name,
    COUNT(*) as record_count
FROM kullanici_profilleri
UNION ALL
SELECT 
    'personel' as table_name,
    COUNT(*) as record_count
FROM personel;
