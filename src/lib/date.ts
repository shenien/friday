// A bare "YYYY-MM-DD" string (as used for all-day calendar events) is a
// calendar date, not an instant — but `new Date("2026-09-15")` parses it as
// UTC midnight, which lands on the *previous* local day in any negative-UTC
// timezone (e.g. 2026-09-14 17:00 in US Pacific). That silently shifts
// all-day event dates by a day. This parses it as local midnight instead.
export function parseLocalDate(dateStr: string): Date {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(dateStr);
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}
