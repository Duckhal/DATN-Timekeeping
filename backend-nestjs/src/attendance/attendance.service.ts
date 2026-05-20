import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { computeAttendance } from './attendance.compute';

export type AttendanceItem = {
  attendance_id: string; // BigInt serialized as string
  date: string; // YYYY-MM-DD
  checkin_time: string | null;
  checkout_time: string | null;
  work_start: string | null;
  work_end: string | null;
  missing_minutes: number;
  total_workday: string;
  status: 'COMPLETED' | 'SHORTHOURS' | 'DAYOFF';
};

export type AttendancePage = {
  items: AttendanceItem[];
  page: number;
  pageSize: number;
  total: number;
  range: { from: string; to: string };
};

@Injectable()
export class AttendanceService {
  private static readonly DEFAULT_PAGE_SIZE = 31;
  private static readonly MAX_PAGE_SIZE = 100;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List attendance rows for a given employee within the resolved date range.
   * Date range resolution priority:
   *   1. (`from`, `to`) when both present.
   *   2. `month=YYYY-MM` → first..last day of that month.
   *   3. Default → current calendar month (server local time).
   */
  async listForEmployee(
    employeeId: number,
    query: QueryAttendanceDto,
  ): Promise<AttendancePage> {
    const { from, to } = this.resolveDateRange(query);
    const page = query.page ?? 1;
    const pageSize = Math.min(
      query.pageSize ?? AttendanceService.DEFAULT_PAGE_SIZE,
      AttendanceService.MAX_PAGE_SIZE,
    );

    const where = {
      employee_id: employeeId,
      date: { gte: from, lte: to },
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.dailyAttendance.count({ where }),
      this.prisma.dailyAttendance.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items: AttendanceItem[] = rows.map((row) => {
      const computed = computeAttendance({
        checkin: row.checkin_time,
        checkout: row.checkout_time,
      });
      return {
        attendance_id: row.attendance_id.toString(),
        date: this.formatDate(row.date),
        checkin_time: computed.checkinTime,
        checkout_time: computed.checkoutTime,
        work_start: computed.workStart,
        work_end: computed.workEnd,
        missing_minutes: computed.missingMinutes,
        total_workday: computed.totalWorkday,
        status: computed.status,
      };
    });

    return {
      items,
      page,
      pageSize,
      total,
      range: { from: this.formatDate(from), to: this.formatDate(to) },
    };
  }

  private resolveDateRange(query: QueryAttendanceDto): { from: Date; to: Date } {
    if (query.from && query.to) {
      const from = this.parseDate(query.from);
      const to = this.parseDate(query.to);
      if (from > to) {
        throw new BadRequestException('`from` must be on or before `to`.');
      }
      return { from, to };
    }

    const monthSpec = query.month ?? this.currentMonth();
    return this.monthRange(monthSpec);
  }

  private currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private monthRange(month: string): { from: Date; to: Date } {
    const [y, m] = month.split('-').map(Number);
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 0); // day 0 of next month = last day of `m`
    from.setHours(0, 0, 0, 0);
    to.setHours(0, 0, 0, 0);
    return { from, to };
  }

  private parseDate(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async findMissingCheckoutDays(employeeId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = await this.prisma.dailyAttendance.findMany({
      where: {
        employee_id: employeeId,
        checkin_time: { not: null },
        checkout_time: null,
        date: { lt: today },
      },
      orderBy: { date: 'desc' },
      take: 30,
      select: {
        attendance_id: true,
        date: true,
        checkin_time: true,
      },
    });

    return rows.map((row) => ({
      attendance_id: row.attendance_id.toString(),
      date: this.formatDate(row.date),
      checkin_time: row.checkin_time
        ? `${String(row.checkin_time.getHours()).padStart(2, '0')}:${String(row.checkin_time.getMinutes()).padStart(2, '0')}`
        : null,
    }));
  }
}
