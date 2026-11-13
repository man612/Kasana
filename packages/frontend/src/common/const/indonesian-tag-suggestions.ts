/** Optional Indonesian-first tag ideas: never automatically written to user accounts. */
export interface TagSuggestion {
  name: string;
  color: string;
}
export const INDONESIAN_TAG_SUGGESTIONS: readonly TagSuggestion[] = [
  { name: 'Keinginan', color: '#15803d' },
  { name: 'Kebutuhan', color: '#a16207' },
  { name: 'Prioritas', color: '#b91c1c' },
  { name: 'Rutin', color: '#1d4ed8' },
  { name: 'Mendesak', color: '#9f1239' },
  { name: 'Langganan', color: '#6d28d9' },
  { name: 'Cicilan', color: '#92400e' },
  { name: 'Patungan', color: '#0f766e' },
  { name: 'Penggantian Biaya', color: '#0369a1' },
  { name: 'Bisnis', color: '#4338ca' },
  { name: 'Pribadi', color: '#7e22ce' },
  { name: 'Keluarga', color: '#7c2d12' },
  { name: 'Pekerjaan', color: '#1e40af' },
  { name: 'Anak', color: '#be185d' },
  { name: 'Kesehatan', color: '#047857' },
  { name: 'Pendidikan', color: '#0e7490' },
  { name: 'Rumah', color: '#57534e' },
  { name: 'Kendaraan', color: '#334155' },
  { name: 'Perjalanan', color: '#7c3aed' },
  { name: 'Hadiah', color: '#a21caf' },
  { name: 'Hobi', color: '#9d174d' },
  { name: 'Kebutuhan Darurat', color: '#991b1b' },
  { name: 'Pajak', color: '#52525b' },
  { name: 'Investasi', color: '#166534' },
  { name: 'Donasi', color: '#115e59' },
  { name: 'Tabungan', color: '#075985' },
] as const;

export function availableTagSuggestions(existing: readonly string[], search: string): TagSuggestion[] {
  const normalized = (name: string) => name.toLocaleLowerCase('id-ID').trim();
  const names = new Set(existing.map(normalized));
  const query = normalized(search);
  return INDONESIAN_TAG_SUGGESTIONS.filter(
    (item) => !names.has(normalized(item.name)) && normalized(item.name).includes(query),
  );
}

/** Core account tags are always available. User-created recommendations remain removable. */
export const CORE_TAG_NAMES = ['Keinginan', 'Kebutuhan', 'Prioritas'] as const;
export const isCoreTagName = (name: string): boolean =>
  CORE_TAG_NAMES.some((item) => item.toLocaleLowerCase('id-ID') === name.trim().toLocaleLowerCase('id-ID'));
