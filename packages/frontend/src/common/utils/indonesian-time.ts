/** Resolve an informative clock-zone label without mislabeling non-Indonesian devices as WIB. */
export function resolveTimeZoneLabel(zone: string | undefined, minutesEast: number): string {
  if (zone === 'Asia/Jakarta' || zone === 'Asia/Pontianak') return 'WIB';
  if (zone === 'Asia/Makassar' || zone === 'Asia/Ujung_Pandang') return 'WITA';
  if (zone === 'Asia/Jayapura') return 'WIT';
  const sign = minutesEast >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(minutesEast) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(minutesEast) % 60).padStart(2, '0');
  return `UTC${sign}${hours}:${minutes}`;
}

/** Uses the browser/device timezone, rather than falsely assuming the user is in Jakarta. */
export function getLocalTimeZoneLabel(): string {
  return resolveTimeZoneLabel(Intl.DateTimeFormat().resolvedOptions().timeZone, -new Date().getTimezoneOffset());
}
