const MALAYSIA_OFFSET_HOURS = 8;

export function malaysiaLocalToUTC(value: string): string {
  // Expected format: YYYY-MM-DDTHH:mm
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );

  if (!match) {
    throw new Error('Invalid event date format');
  }

  const [, year, month, day, hour, minute] = match;

  const localAsUTC = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  );

  // Check that the entered date actually exists.
  const check = new Date(localAsUTC);

  if (
    check.getUTCFullYear() !== Number(year) ||
    check.getUTCMonth() + 1 !== Number(month) ||
    check.getUTCDate() !== Number(day) ||
    check.getUTCHours() !== Number(hour) ||
    check.getUTCMinutes() !== Number(minute)
  ) {
    throw new Error('Invalid event date');
  }

  // Malaysia is UTC+8.
  const utcTime =
    localAsUTC - MALAYSIA_OFFSET_HOURS * 60 * 60 * 1000;

  return new Date(utcTime).toISOString();
}