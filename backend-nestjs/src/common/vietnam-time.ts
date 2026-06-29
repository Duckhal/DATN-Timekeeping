const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';

type BusinessDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const businessDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function businessParts(value: Date): BusinessDateTimeParts {
  if (Number.isNaN(value.getTime())) {
    throw new RangeError('Invalid date value.');
  }

  const parts = Object.fromEntries(
    businessDateTimeFormatter
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** PostgreSQL DATE boundary: always represented as UTC midnight. */
export function dateOnlyFromIso(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new RangeError(`Invalid date-only value: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const result = new Date(Date.UTC(year, month - 1, day));
  if (
    result.getUTCFullYear() !== year ||
    result.getUTCMonth() !== month - 1 ||
    result.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid date-only value: ${value}`);
  }
  return result;
}

export function formatDateOnly(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}

export function businessDateFromInstant(
  value: Date,
  previousDayBeforeHour = 0,
): Date {
  const parts = businessParts(value);
  const result = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (parts.hour < previousDayBeforeHour) {
    result.setUTCDate(result.getUTCDate() - 1);
  }
  return result;
}

/** PostgreSQL TIME boundary: Vietnamese wall-clock time anchored in UTC. */
export function businessTimeFromInstant(value: Date): Date {
  const parts = businessParts(value);
  return new Date(Date.UTC(1970, 0, 1, parts.hour, parts.minute, parts.second));
}

export function timeOnlyFromString(value: string): Date {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    throw new RangeError(`Invalid time-only value: ${value}`);
  }
  return new Date(Date.UTC(1970, 0, 1, Number(match[1]), Number(match[2])));
}

export function formatTimeOnly(value: Date, includeSeconds = false): string {
  const base = `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
  return includeSeconds
    ? `${base}:${String(value.getUTCSeconds()).padStart(2, '0')}`
    : base;
}

export function currentBusinessMonth(now = new Date()): string {
  const parts = businessParts(now);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

export function monthDateRange(month: string): { from: Date; to: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) {
    throw new RangeError(`Invalid month value: ${month}`);
  }
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) {
    throw new RangeError(`Invalid month value: ${month}`);
  }
  return {
    from: new Date(Date.UTC(year, monthNumber - 1, 1)),
    to: new Date(Date.UTC(year, monthNumber, 0)),
  };
}

export function addDateOnlyDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function dateOnlyDayOfWeek(value: Date): number {
  return value.getUTCDay();
}
