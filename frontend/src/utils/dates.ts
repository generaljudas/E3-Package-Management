/**
 * Server timestamps come from SQLite's CURRENT_TIMESTAMP / datetime('now'),
 * which are UTC but carry no zone marker ("2026-09-02 06:30:00"). Handing that
 * string to `new Date()` reads it as *local* time, so every received/pickup
 * time would display shifted by the store's UTC offset. Treat zone-less
 * server timestamps as UTC; leave ISO strings with an explicit zone alone.
 */
const ZONELESS = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

export function parseServerDate(
  value: string | number | Date | null | undefined
): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  const s = value.trim();
  const d = new Date(ZONELESS.test(s) ? `${s.replace(' ', 'T')}Z` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatServerDateTime(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }
): string {
  const d = parseServerDate(value);
  return d ? d.toLocaleString(undefined, options) : '';
}
