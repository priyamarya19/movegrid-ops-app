// Small shared input validators. Scope: phone + email only.

/** Strip everything that isn't a digit. */
export function digitsOnly(v: string): string {
  return v.replace(/\D/g, '');
}

/** Exactly 10 numeric digits (0-9), no country code / separators. */
export function isValidMobile(v: string): boolean {
  return /^\d{10}$/.test(v.trim());
}

/** RFC-lite email check. */
export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
