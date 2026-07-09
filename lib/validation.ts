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

/** Exactly 12 digits (spaces allowed as separators). */
export function isValidAadhaar(v: string): boolean {
  return /^\d{12}$/.test(v.replace(/\s/g, ''));
}

/** Standard PAN: 5 letters, 4 digits, 1 letter (case-insensitive). */
export function isValidPAN(v: string): boolean {
  return /^[A-Za-z]{5}\d{4}[A-Za-z]$/.test(v.trim());
}

/** Standard IFSC: 4 letters, 0, then 6 alphanumerics (case-insensitive). */
export function isValidIFSC(v: string): boolean {
  return /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(v.trim());
}
