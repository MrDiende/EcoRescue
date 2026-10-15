export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PH_PHONE_RE = /^(09\d{9}|\+639\d{9})$/;
export const isEmail = (v) => EMAIL_RE.test(v.trim());
export const isPhone = (v) => PH_PHONE_RE.test(v.replace(/[\s-]/g, ''));
export const normalizePhone = (v) => v.replace(/[\s-]/g, '');
/** Combine first and last name into a single stored name. */
export const combineName = (first, last) => `${first.trim()} ${last.trim()}`.trim().replace(/\s+/g, ' ');
/** Split a stored full name back into { first, last } for editing (last word = last name). */
export function splitName(full) {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] ?? '', last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}
export function passwordProblem(pw) {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw)) return 'Password must include an uppercase letter.';
  if (!/[a-z]/.test(pw)) return 'Password must include a lowercase letter.';
  if (!/\d/.test(pw)) return 'Password must include a number.';
  return null;
}
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_MB = 5;
export function imageProblem(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Only JPG, PNG, or WEBP images are allowed.';
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return `Image must be ${MAX_IMAGE_MB} MB or smaller.`;
  return null;
}
export const PLATE_RE = /^[A-Z]{2,3}[\s-]?\d{3,4}$/;
export const isPlate = (v) => PLATE_RE.test(v.trim().toUpperCase());
export function hasErrors(e) {
  return Object.values(e).some(Boolean);
}
export const required = (v, label) => (!v || !String(v).trim() ? `${label} is required.` : undefined);
