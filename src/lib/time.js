const pad = (n) => String(n).padStart(2, '0');
export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayISO() {
  return toISODate(new Date());
}
export function parseISODate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function scheduleDateTime(date, time) {
  const d = parseISODate(date);
  const [h, mi] = (time || '00:00').split(':').map(Number);
  d.setHours(h || 0, mi || 0, 0, 0);
  return d;
}
export function addDays(d, n) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
export function isValidISODate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseISODate(s);
  return toISODate(d) === s;
}
export function isValidTime(s) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}
export function formatDate(s, opts) {
  if (!s) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? parseISODate(s) : new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-PH', opts ?? { month: 'short', day: 'numeric', year: 'numeric' });
}
export function formatDayDate(s) {
  return formatDate(s, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
export function formatTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${pad(m || 0)} ${suffix}`;
}
export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
export function timeAgo(iso) {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return '—';
  const s = Math.round(diff / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
  return formatDate(iso);
}
export function isPast(date, time) {
  return scheduleDateTime(date, time).getTime() < Date.now();
}
export function isToday(date) {
  return date === todayISO();
}
/** Returns ISO dates within [start, start+days) that fall on the given weekdays (0=Sun). */
export function datesForWeekdays(start, days, weekdays) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    if (weekdays.includes(d.getDay())) out.push(toISODate(d));
  }
  return out;
}
export function nowISO() {
  return new Date().toISOString();
}
