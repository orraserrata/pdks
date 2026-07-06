import { differenceInCalendarDays } from "date-fns";

export const YILLIK_IZIN_GUN = 14;
export const TAM_ZAMANLI_YILLIK_CALISMA_GUN = 260;

export const CALISMA_TIPI_OPTIONS = [
  { value: "full_time", label: "Tam Zamanlı" },
  { value: "part_time", label: "Yarı Zamanlı" },
];

export function getCalismaTipi(personel) {
  return personel?.calisma_tipi || "full_time";
}

export function getCalismaTipiLabel(calismaTipi) {
  return CALISMA_TIPI_OPTIONS.find((o) => o.value === calismaTipi)?.label || "Tam Zamanlı";
}

export function isPartTime(personel) {
  return getCalismaTipi(personel) === "part_time";
}

export function calcYearsEmployed(iseGirisTarihi, referenceDate = new Date()) {
  if (!iseGirisTarihi) return 0;
  const iseGiris = new Date(iseGirisTarihi);
  let years = Math.floor(differenceInCalendarDays(referenceDate, iseGiris) / 365.25);
  if (isNaN(years) || years < 0) years = 0;
  return years;
}

export function calcOtomatikHakedilenIzin({
  calisma_tipi,
  ise_giris_tarihi,
  total_working_days,
}) {
  if (isPartTime({ calisma_tipi })) {
    const days = total_working_days || 0;
    if (days <= 0) return 0;
    return Math.round((days / TAM_ZAMANLI_YILLIK_CALISMA_GUN) * YILLIK_IZIN_GUN);
  }

  return calcYearsEmployed(ise_giris_tarihi) * YILLIK_IZIN_GUN;
}

export function calcYillikIzinOzeti(personelRow) {
  const manuelHakedilen = personelRow.manuel_hakedilen_izin || 0;
  const otomatikHakedilen = calcOtomatikHakedilenIzin(personelRow);
  const totalEarned = manuelHakedilen + otomatikHakedilen;
  const devreden = personelRow.devreden_yillik_izin || 0;
  const usedTotal = (personelRow.manuel_kullanilan_izin || 0) + (personelRow.used_leave || 0);
  const remaining = totalEarned + devreden - usedTotal;
  const yearsEmployed = calcYearsEmployed(personelRow.ise_giris_tarihi);
  const totalDays = personelRow.total_working_days || 0;
  const calismaTipi = getCalismaTipi(personelRow);

  return {
    calismaTipi,
    manuelHakedilen,
    otomatikHakedilen,
    totalEarned,
    devreden,
    usedTotal,
    remaining,
    yearsEmployed,
    totalDays,
  };
}
