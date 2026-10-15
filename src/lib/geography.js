export const BARANGAY_NAME = 'Barangay M.S. Garcia';
export const BARANGAY_SHORT = 'M.S. Garcia';
export const MUNICIPALITY = 'Cabanatuan City, Nueva Ecija';
export const POSTAL_CODE = '3100';
/** Default address auto-filled for new residents and collectors. */
export const DEFAULT_ADDRESS = 'M.S. Garcia, Cabanatuan City';
/** PSA 2020 census population of Barangay M.S. Garcia (source: PhilAtlas). */
export const POPULATION_2020 = 6148;
/**
 * Barangay centre: ~15.4773 N, 120.9648 E — between the PhilAtlas reference point
 * (15.4772, 120.9638) and the OpenStreetMap "M. S. Garcia" place node (15.4773, 120.9652).
 *
 * IMPORTANT: OpenStreetMap does not (yet) contain the barangay boundary or the Purok
 * locations of M.S. Garcia. The Barangay Hall and Purok 1–8 points below are APPROXIMATE
 * placements around the barangay centre. Replace them with surveyed coordinates
 * (e.g. right-click a spot on openstreetmap.org → "Show address") for accurate tracking.
 */
export const BASE = {
  name: 'M.S. Garcia Barangay Hall (Collection Base)',
  lat: 15.4774,
  lng: 120.9647,
};
export const PUROKS = [
  'Purok 1',
  'Purok 2',
  'Purok 3',
  'Purok 4',
  'Purok 5',
  'Purok 6',
  'Purok 7',
  'Purok 8',
];
/** `label` is optional: put the local Purok name here (e.g. "Sampaguita") if it has one. */
// Tight ring (~170 m) around the Barangay Hall so the 8 Puroks sit within the
// M.S. Garcia vicinity. Still APPROXIMATE — replace with surveyed coordinates
// (right-click a spot on openstreetmap.org → "Show address") when available.
export const PUROK_INFO = {
  'Purok 1': { lat: 15.4789, lng: 120.9647, label: '' }, // N
  'Purok 2': { lat: 15.47846, lng: 120.96583, label: '' }, // NE
  'Purok 3': { lat: 15.4774, lng: 120.9663, label: '' }, // E
  'Purok 4': { lat: 15.47634, lng: 120.96583, label: '' }, // SE
  'Purok 5': { lat: 15.4759, lng: 120.9647, label: '' }, // S
  'Purok 6': { lat: 15.47634, lng: 120.96357, label: '' }, // SW
  'Purok 7': { lat: 15.4774, lng: 120.9631, label: '' }, // W
  'Purok 8': { lat: 15.47846, lng: 120.96357, label: '' }, // NW
};
export const COORDINATES_APPROXIMATE = true;
/* ---------- Collection plan ---------- */
/** One truck covers all 8 Puroks, twice a week: Monday and Thursday. */
export const COLLECTION_DAYS = [1, 4];
export const COLLECTION_TIME = '07:30';
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** "Monday & Thursday" / "Mon, Wed & Fri" */
export function describeDays(days = COLLECTION_DAYS, short = false) {
  const names = [...days].sort((a, b) => a - b).map((d) => (short ? WEEKDAY_SHORT : WEEKDAY_LONG)[d]);
  if (names.length <= 1) return names[0] ?? '—';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}
export function purokPoint(purok) {
  return PUROK_INFO[purok] ?? BASE;
}
/** "Purok 3" or "Purok 3 (Local name)" when a local name is configured. */
export function purokLabel(purok) {
  const label = PUROK_INFO[purok]?.label;
  return label ? `${purok} (${label})` : purok;
}
/** " · Local name" or "" — for compact displays. */
export function purokSuffix(purok) {
  const label = PUROK_INFO[purok]?.label;
  return label ? ` · ${label}` : '';
}
export function sortPuroks(list) {
  return [...list].sort((a, b) => PUROKS.indexOf(a) - PUROKS.indexOf(b));
}
