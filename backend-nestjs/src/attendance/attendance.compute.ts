/**
 * Attendance computation utilities.
 *
 * The core math follows Timekeeping.md §3.1 (Standard Work Calculation):
 *   T_out_std       = min(T_out, 18:30:00)
 *   S_lunch_overlap = Overlap(T_in, T_out_std, 12:00:00, 13:30:00)
 *   S_work          = (T_out_std - T_in) - S_lunch_overlap
 *   Daily_Credit    = min(1.0, S_work / 28800)
 *
 * Working-window display rule (per product decision 2026-05-17):
 *   - check-in earlier than 08:00 → window [08:00, 17:30]
 *   - check-in within [08:00, 09:00) → window [check-in, check-in + 9h30]
 *   - check-in from 09:00 onward → window [09:00, 18:30]
 * The 9h30 span = 8h standard work + 1h30 lunch.
 *
 * All time math is done in seconds-since-midnight to avoid timezone drift on
 * the date portion. Inputs from Prisma may carry an arbitrary base date for
 * `@db.Time(0)` columns; only the time-of-day portion matters here.
 */

const SECONDS_PER_HOUR = 3600;
const STANDARD_WORK_SECONDS = 8 * SECONDS_PER_HOUR; // 28800
const LUNCH_SPAN_SECONDS = 1.5 * SECONDS_PER_HOUR; // 5400

const T_0800 = 8 * SECONDS_PER_HOUR;
const T_0900 = 9 * SECONDS_PER_HOUR;
const T_1200 = 12 * SECONDS_PER_HOUR;
const T_1330 = 13 * SECONDS_PER_HOUR + 30 * 60;
const T_1730 = 17 * SECONDS_PER_HOUR + 30 * 60;
const T_1830 = 18 * SECONDS_PER_HOUR + 30 * 60;

export type WorkingWindow = {
  /** HH:mm */
  workStart: string;
  /** HH:mm */
  workEnd: string;
};

export type AttendanceComputed = {
  /** Same time-of-day as `checkin` formatted HH:mm:ss, or null. */
  checkinTime: string | null;
  /** Same time-of-day as `checkout` formatted HH:mm:ss, or null. */
  checkoutTime: string | null;
  workStart: string | null;
  workEnd: string | null;
  /** Decimal string with 4 decimals to match the schema (Decimal(5,4)). */
  totalWorkday: string;
  missingMinutes: number;
  status: 'COMPLETED' | 'SHORTHOURS' | 'DAYOFF';
};

/**
 * Convert a Date (or null) into seconds-since-midnight. Returns null when the
 * input is null. Uses local hours to match how Postgres `time` columns are
 * read by Prisma (no timezone metadata).
 */
export function toSecondsOfDay(t: Date | null | undefined): number | null {
  if (!t) return null;
  return t.getHours() * SECONDS_PER_HOUR + t.getMinutes() * 60 + t.getSeconds();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatHHmm(secOfDay: number): string {
  const h = Math.floor(secOfDay / SECONDS_PER_HOUR);
  const m = Math.floor((secOfDay % SECONDS_PER_HOUR) / 60);
  return `${pad2(h)}:${pad2(m)}`;
}

function formatHHmmss(secOfDay: number): string {
  const h = Math.floor(secOfDay / SECONDS_PER_HOUR);
  const m = Math.floor((secOfDay % SECONDS_PER_HOUR) / 60);
  const s = secOfDay % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/**
 * Resolve the working window shown to the employee, given the actual check-in
 * second-of-day. See the rule list at the top of this file.
 */
export function deriveWorkingWindow(checkinSec: number | null): WorkingWindow | null {
  if (checkinSec === null) return null;

  if (checkinSec < T_0800) {
    return { workStart: formatHHmm(T_0800), workEnd: formatHHmm(T_1730) };
  }
  if (checkinSec < T_0900) {
    const startSec = checkinSec - (checkinSec % 60); // round down to minute
    const endSec = startSec + STANDARD_WORK_SECONDS + LUNCH_SPAN_SECONDS;
    return { workStart: formatHHmm(startSec), workEnd: formatHHmm(endSec) };
  }
  return { workStart: formatHHmm(T_0900), workEnd: formatHHmm(T_1830) };
}

/**
 * Compute the standard daily credit using the §3.1 overlap formula.
 * Returns a number in the range [0, 1].
 */
export function computeStandardCredit(
  checkinSec: number,
  checkoutSec: number,
): number {
  if (checkoutSec <= checkinSec) return 0;
  const tOutStd = Math.min(checkoutSec, T_1830);
  if (tOutStd <= checkinSec) return 0;
  const lunchOverlap = overlap(checkinSec, tOutStd, T_1200, T_1330);
  const sWork = tOutStd - checkinSec - lunchOverlap;
  if (sWork <= 0) return 0;
  return Math.min(1, sWork / STANDARD_WORK_SECONDS);
}

/**
 * Pure function — given raw DailyAttendance fields, derive every field shown
 * on the portal. Stores `total_workday` and `status` are *ignored* for now;
 * Issue 1 / Option C: compute on read, never persist back.
 */
export function computeAttendance(input: {
  checkin: Date | null;
  checkout: Date | null;
}): AttendanceComputed {
  const checkinSec = toSecondsOfDay(input.checkin);
  const checkoutSec = toSecondsOfDay(input.checkout);

  if (checkinSec === null && checkoutSec === null) {
    return {
      checkinTime: null,
      checkoutTime: null,
      workStart: null,
      workEnd: null,
      totalWorkday: '0.0000',
      missingMinutes: 0,
      status: 'DAYOFF',
    };
  }

  const window = deriveWorkingWindow(checkinSec);

  // Without a checkout the day cannot be credited. Per Timekeeping.md §2.2
  // a missing scan yields zero credit until an explanation request fixes it.
  if (checkinSec === null || checkoutSec === null) {
    return {
      checkinTime: checkinSec !== null ? formatHHmmss(checkinSec) : null,
      checkoutTime: checkoutSec !== null ? formatHHmmss(checkoutSec) : null,
      workStart: window?.workStart ?? null,
      workEnd: window?.workEnd ?? null,
      totalWorkday: '0.0000',
      missingMinutes: STANDARD_WORK_SECONDS / 60,
      status: 'SHORTHOURS',
    };
  }

  const credit = computeStandardCredit(checkinSec, checkoutSec);
  const workedSeconds = credit * STANDARD_WORK_SECONDS;
  const missingMinutes = Math.max(
    0,
    Math.round((STANDARD_WORK_SECONDS - workedSeconds) / 60),
  );
  const status: AttendanceComputed['status'] =
    credit >= 1 ? 'COMPLETED' : 'SHORTHOURS';

  return {
    checkinTime: formatHHmmss(checkinSec),
    checkoutTime: formatHHmmss(checkoutSec),
    workStart: window?.workStart ?? null,
    workEnd: window?.workEnd ?? null,
    totalWorkday: credit.toFixed(4),
    missingMinutes,
    status,
  };
}
