/** Display the device's real timezone. Never label another timezone WIB. */
export function getLocalTimeZoneLabel(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (['Asia/Jakarta', 'Asia/Pontianak'].includes(zone)) return 'WIB';
  if (['Asia/Makassar', 'Asia/Ujung_Pandang'].includes(zone)) return 'WITA';
  if (zone === 'Asia/Jayapura') return 'WIT';
  const minutesEast = -new Date().getTimezoneOffset();
  const sign = minutesEast >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(minutesEast) / 60)).padStart(2, '0');
  const mm = String(Math.abs(minutesEast) % 60).padStart(2, '0');
  return `UTC${sign}${hh}:${mm}`;
}
