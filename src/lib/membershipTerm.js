export const MEMBERSHIP_DAYS = 30;

export function dateOnlyUtc(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

export function addCalendarDays(day, days) {
  const match = String(day || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + Number(days));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
}

// Expiry is the activation calendar day plus 30 days. The same YYYY-MM-DD is
// stored on the customer and used as the date prefix of the membership record.
export function membershipExpiryDay(activatedAt, days = MEMBERSHIP_DAYS) {
  const start = dateOnlyUtc(activatedAt);
  if (!start) return '';
  return addCalendarDays(start, days);
}

export function membershipExpiryIso(activatedAt, days = MEMBERSHIP_DAYS) {
  const day = membershipExpiryDay(activatedAt, days);
  return day ? `${day}T12:00:00.000Z` : '';
}
