import { supabase } from "../supabaseClient";

export const DEFAULT_HEDEFLER = {
  saatli: 240,
  gunluk: 22,
};

export function calcBirimUcret(aylikMaas, maasTipi, hedefAyarlari) {
  const hedef = maasTipi === "gunluk"
    ? hedefAyarlari.gunluk
    : hedefAyarlari.saatli;
  if (!hedef || hedef <= 0) return 0;
  return aylikMaas / hedef;
}

export function getHedefDeger(maasTipi, hedefAyarlari) {
  return maasTipi === "gunluk"
    ? hedefAyarlari.gunluk
    : hedefAyarlari.saatli;
}

export async function fetchMaasHedefleri() {
  const { data, error } = await supabase
    .from("maas_hedef_ayarlari")
    .select("maas_tipi, hedef_deger");

  if (error) return { hedefler: { ...DEFAULT_HEDEFLER }, error };

  const hedefler = { ...DEFAULT_HEDEFLER };
  (data || []).forEach((row) => {
    if (row.maas_tipi === "saatli" || row.maas_tipi === "gunluk") {
      hedefler[row.maas_tipi] = row.hedef_deger;
    }
  });

  return { hedefler, error: null };
}

export async function saveMaasHedef(maasTipi, hedefDeger) {
  const { error } = await supabase
    .from("maas_hedef_ayarlari")
    .upsert({
      maas_tipi: maasTipi,
      hedef_deger: parseInt(hedefDeger, 10),
      updated_at: new Date().toISOString(),
    });

  return { error };
}
