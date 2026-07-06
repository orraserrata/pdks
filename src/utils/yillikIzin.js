import { differenceInCalendarDays } from "date-fns";

export const YILLIK_IZIN_GUN = 14;
export const PART_TIME_IZIN_ESIK_GUN = 300;

export function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Bitiş tarihi eksklüsif: bitis = son izin gününün ertesi günü */
export function calcIzinGunSayisi(baslangic, bitis) {
  const start = parseLocalDate(baslangic);
  const end = parseLocalDate(bitis);
  if (!start || !end) return 0;
  const days = differenceInCalendarDays(end, start);
  return days > 0 ? days : 0;
}

/** Seçilen tarih aralığı (dahil) içindeki izin gün sayısı; izin bitişi eksklüsif */
export function calcIzinGunInRange(izinBaslangic, izinBitisExclusive, rangeStartStr, rangeEndStr) {
  const izinStart = parseLocalDate(izinBaslangic);
  const izinEndExclusive = parseLocalDate(izinBitisExclusive);
  const rangeStart = parseLocalDate(rangeStartStr);
  const rangeEnd = parseLocalDate(rangeEndStr);
  if (!izinStart || !izinEndExclusive || !rangeStart || !rangeEnd) return 0;

  const izinLastDay = new Date(izinEndExclusive);
  izinLastDay.setDate(izinLastDay.getDate() - 1);

  const effectiveStart = izinStart > rangeStart ? izinStart : rangeStart;
  const effectiveEnd = izinLastDay < rangeEnd ? izinLastDay : rangeEnd;

  if (effectiveStart > effectiveEnd) return 0;
  return differenceInCalendarDays(effectiveEnd, effectiveStart) + 1;
}

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
    return Math.floor(days / PART_TIME_IZIN_ESIK_GUN) * YILLIK_IZIN_GUN;
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
