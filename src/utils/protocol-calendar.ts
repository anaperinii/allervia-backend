/** Calendar arithmetic in the clinic's IANA time zone; rejects nonexistent DST wall times. */
function parts(date: Date, timeZone: string): number[] {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return ['year', 'month', 'day', 'hour', 'minute', 'second'].map((key) =>
    Number(values.find((part) => part.type === key)!.value),
  );
}
function wallTimestamp(date: Date, zone: string) {
  const [year, month, day, hour, minute, second] = parts(date, zone);
  return Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    date.getUTCMilliseconds(),
  );
}
export function localCalendarDay(date: Date, zone: string): string {
  return parts(date, zone).slice(0, 3).join('-');
}
export function addProtocolCalendarDays(
  date: Date,
  days: number,
  zone: string,
): Date {
  if (
    !Number.isFinite(date.getTime()) ||
    !Number.isSafeInteger(days) ||
    days < 1
  )
    throw new RangeError('Invalid calendar input');
  const wall = wallTimestamp(date, zone);
  const target = wall + days * 86400000;
  let result = new Date(date.getTime() + days * 86400000);
  for (let attempt = 0; attempt < 4; attempt++) {
    const actual = wallTimestamp(result, zone);
    if (actual === target) return result;
    result = new Date(result.getTime() + target - actual);
  }
  throw new RangeError(
    'Nonexistent local time; explicit scheduling review required',
  );
}
