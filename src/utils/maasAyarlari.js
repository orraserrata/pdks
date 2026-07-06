import { supabase } from "../supabaseClient";
import { fetchMaasHedefleri, DEFAULT_HEDEFLER } from "./maasHedefleri";

/** Maaş ayarı yoksa varsayılan kayıt oluşturur. */
export async function ensureMaasAyari(kullaniciId, aktif = true) {
  const { data: existing, error: fetchError } = await supabase
    .from("maas_ayarlari")
    .select("kullanici_id")
    .eq("kullanici_id", kullaniciId)
    .maybeSingle();

  if (fetchError) return { created: false, error: fetchError };
  if (existing) return { created: false, error: null };

  const { hedefler } = await fetchMaasHedefleri();

  const { error } = await supabase.from("maas_ayarlari").insert({
    kullanici_id: kullaniciId,
    aylik_maas: 0,
    hedef_saat: hedefler.saatli || DEFAULT_HEDEFLER.saatli,
    aktif,
  });

  return { created: true, error };
}

/** Personel aktif/pasif durumunu maaş ayarlarına yansıtır; kayıt yoksa oluşturur. */
export async function syncMaasAyariAktif(kullaniciId, aktif) {
  const { data: existing, error: fetchError } = await supabase
    .from("maas_ayarlari")
    .select("kullanici_id")
    .eq("kullanici_id", kullaniciId)
    .maybeSingle();

  if (fetchError) return { error: fetchError };

  if (existing) {
    const { error } = await supabase
      .from("maas_ayarlari")
      .update({ aktif })
      .eq("kullanici_id", kullaniciId);
    return { error };
  }

  return ensureMaasAyari(kullaniciId, aktif);
}
