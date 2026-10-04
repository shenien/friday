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

export function timeAgo(iso: string | null) {
  if (!iso) return "never";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}
