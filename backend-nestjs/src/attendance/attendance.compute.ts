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
const T_2000 = 20 * SECONDS_PER_HOUR;

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
  status: 'COMPLETED' | 'SHORTHOURS' | 'DAYOFF' | 'WEEKEND';
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
 * Compute the standard daily credit using the §3.1 / §3.2 overlap formula.
 *
 * Branches:
 *   - weekday + no OT  → cap T_out at 18:30, deduct lunch overlap, cap credit at 1.0
 *   - weekday + OT     → no 18:30 cap, deduct lunch + dinner overlap, no credit cap
 *   - weekend + no OT  → 0 (caller decides; this branch returns 0 for safety)
 *   - weekend + OT     → no caps, deduct lunch + dinner overlap
 */
export function computeStandardCredit(
  checkinSec: number,
  checkoutSec: number,
  otApproved = false,
  isWeekend = false,
): number {
  if (checkoutSec <= checkinSec) return 0;

  if (isWeekend && !otApproved) return 0;

  const liftCap = otApproved; // both weekday-OT and weekend-OT lift the 18:30 / 1.0 caps
  const tOutStd = liftCap ? checkoutSec : Math.min(checkoutSec, T_1830);
  if (tOutStd <= checkinSec) return 0;

  const lunchOverlap = overlap(checkinSec, tOutStd, T_1200, T_1330);
  const dinnerOverlap = otApproved
    ? overlap(checkinSec, tOutStd, T_1830, T_2000)
    : 0;

  const sWork = tOutStd - checkinSec - lunchOverlap - dinnerOverlap;
  if (sWork <= 0) return 0;

  return liftCap
    ? sWork / STANDARD_WORK_SECONDS
    : Math.min(1, sWork / STANDARD_WORK_SECONDS);
}

/**
 * Pure function — given raw DailyAttendance fields, derive every field shown
 * on the portal. Stores `total_workday` and `status` are *ignored* for now;
 * Issue 1 / Option C: compute on read, never persist back.
 *
 * Weekend rule (added 2026-06-02):
 *   - If `isWeekend` and no `otApproved` → status = WEEKEND, credit = 0,
 *     missing_minutes = 0 (do NOT penalize the employee for not working).
 *   - If `isWeekend` and `otApproved` → compute via `computeStandardCredit`
 *     using the OT branch (no caps, lunch + dinner overlaps deducted).
 */
export function computeAttendance(input: {
  checkin: Date | null;
  checkout: Date | null;
  otApproved?: boolean;
  isWeekend?: boolean;
}): AttendanceComputed {
  const checkinSec = toSecondsOfDay(input.checkin);
  const checkoutSec = toSecondsOfDay(input.checkout);
  const isWeekend = input.isWeekend === true;
  const otApproved = input.otApproved === true;

  if (checkinSec === null && checkoutSec === null) {
    return {
      checkinTime: null,
      checkoutTime: null,
      workStart: null,
      workEnd: null,
      totalWorkday: '0.0000',
      missingMinutes: 0,
      status: isWeekend ? 'WEEKEND' : 'DAYOFF',
    };
  }

  const window = deriveWorkingWindow(checkinSec);

  // Weekend without approved OT: show the scan times but credit = 0 and no penalty.
  if (isWeekend && !otApproved) {
    return {
      checkinTime: checkinSec !== null ? formatHHmmss(checkinSec) : null,
      checkoutTime: checkoutSec !== null ? formatHHmmss(checkoutSec) : null,
      workStart: window?.workStart ?? null,
      workEnd: window?.workEnd ?? null,
      totalWorkday: '0.0000',
      missingMinutes: 0,
      status: 'WEEKEND',
    };
  }

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

  const credit = computeStandardCredit(checkinSec, checkoutSec, otApproved, isWeekend);
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
