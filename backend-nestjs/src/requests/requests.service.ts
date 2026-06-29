import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOtRequestDto } from './dto/create-ot-request.dto';
import { CreateExplanationRequestDto } from './dto/create-explanation-request.dto';
import { QueryRequestsDto } from './dto/query-requests.dto';
import {
  computeStandardCredit,
  toSecondsOfDay,
} from '../attendance/attendance.compute';
import type { RequestStatus } from '../types/enums';
import {
  addDateOnlyDays,
  businessDateFromInstant,
  dateOnlyDayOfWeek,
  dateOnlyFromIso,
  formatDateOnly,
  formatTimeOnly,
  timeOnlyFromString,
} from '../common/vietnam-time';

const REQUEST_SELECT = {
  request_id: true,
  employee_id: true,
  attendance_id: true,
  type: true,
  status: true,
  date: true,
  start_time: true,
  end_time: true,
  reason: true,
  created_at: true,
  updated_at: true,
};

const MANAGER_REQUEST_SELECT = {
  ...REQUEST_SELECT,
  employee: { select: { full_name: true, email: true } },
};

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createOtRequest(employeeId: number, dto: CreateOtRequestDto) {
    const today = this.todayDate();
    const targetDate = dto.date ? this.parseDateString(dto.date) : today;

    // Allow OT requests for today through 7 days ahead (inclusive).
    const maxDate = this.addDays(today, 7);
    if (targetDate < today || targetDate > maxDate) {
      throw new BadRequestException(
        'OT request date must be between today and 7 days ahead.',
      );
    }

    const existing = await this.prisma.request.findFirst({
      where: {
        employee_id: employeeId,
        type: 'OT',
        status: 'PENDING',
        date: targetDate,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'You already have a pending OT request for that date.',
      );
    }

    const request = await this.prisma.request.create({
      data: {
        employee_id: employeeId,
        type: 'OT',
        date: targetDate,
        reason: dto.reason,
      },
      select: REQUEST_SELECT,
    });

    this.logger.log(
      `[CreateOT] employee=${employeeId} request_id=${request.request_id} date=${this.formatDate(targetDate)}`,
    );
    return this.formatRequest(request);
  }

  async createExplanationRequest(
    employeeId: number,
    dto: CreateExplanationRequestDto,
  ) {
    const attendance = await this.prisma.dailyAttendance.findUnique({
      where: { attendance_id: BigInt(dto.attendance_id) },
    });
    if (!attendance) {
      throw new NotFoundException('Attendance record not found.');
    }
    if (attendance.employee_id !== employeeId) {
      throw new ForbiddenException(
        'This attendance record does not belong to you.',
      );
    }
    if (attendance.checkout_time !== null) {
      throw new BadRequestException('This day already has a checkout time.');
    }

    const attendanceDate = attendance.date;
    const today = this.todayDate();
    if (attendanceDate >= today) {
      throw new BadRequestException('Can only explain past days.');
    }

    const monthYear = this.toMonthYear(attendanceDate);
    const limit = await this.prisma.monthlyLimit.findUnique({
      where: {
        employee_id_month_year: {
          employee_id: employeeId,
          month_year: monthYear,
        },
      },
    });
    if (limit && limit.explanation_count >= 2) {
      throw new BadRequestException('Monthly explanation limit reached (2/2).');
    }

    const duplicate = await this.prisma.request.findFirst({
      where: {
        employee_id: employeeId,
        type: 'EXPLANATION',
        attendance_id: BigInt(dto.attendance_id),
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });
    if (duplicate) {
      throw new BadRequestException(
        'An explanation request already exists for this day.',
      );
    }

    let endTime: Date | null = null;
    if (dto.end_time) {
      endTime = this.parseTimeToDate(dto.end_time);
    } else {
      const hasApprovedOt = await this.prisma.request.findFirst({
        where: {
          employee_id: employeeId,
          type: 'OT',
          status: 'APPROVED',
          date: attendanceDate,
        },
      });
      if (hasApprovedOt) {
        throw new BadRequestException(
          'This day has an approved OT request. Please provide end_time.',
        );
      }
      endTime = this.parseTimeToDate('17:30');
    }

    const request = await this.prisma.request.create({
      data: {
        employee_id: employeeId,
        type: 'EXPLANATION',
        date: attendanceDate,
        attendance_id: BigInt(dto.attendance_id),
        end_time: endTime,
        reason: dto.reason,
      },
      select: REQUEST_SELECT,
    });

    this.logger.log(
      `[CreateExplanation] employee=${employeeId} request_id=${request.request_id} attendance_id=${dto.attendance_id}`,
    );
    return this.formatRequest(request);
  }

  // PLACEHOLDER_REMAINING_METHODS

  async findByEmployee(employeeId: number, query: QueryRequestsDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where: any = { employee_id: employeeId };
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.request.count({ where }),
      this.prisma.request.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: REQUEST_SELECT,
      }),
    ]);

    return {
      items: rows.map((r) => this.formatRequest(r)),
      page,
      pageSize,
      total,
    };
  }

  async findForManager(actorRole: string, query: QueryRequestsDto) {
    this.assertManager(actorRole);

    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const search = query.search?.trim();

    const where: any = {};
    if (query.status) where.status = query.status as RequestStatus;
    if (query.type) where.type = query.type;
    if (search) {
      where.employee = {
        is: {
          OR: [
            { full_name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
      };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.request.count({ where }),
      this.prisma.request.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: MANAGER_REQUEST_SELECT,
      }),
    ]);

    this.logger.log(
      `[ManagerRequestList] status=${query.status ?? 'ALL'} type=${query.type ?? 'ALL'} search=${search ? 'yes' : 'no'} page=${page} pageSize=${pageSize} total=${total}`,
    );

    return {
      items: rows.map((r) => this.formatRequest(r)),
      page,
      pageSize,
      total,
    };
  }

  async approveRequest(requestId: number, actorId: number, actorRole: string) {
    this.assertManager(actorRole);

    const request = await this.prisma.request.findUnique({
      where: { request_id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found.');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only PENDING requests can be approved.');
    }

    if (request.type === 'EXPLANATION') {
      return this.approveExplanation(request);
    }

    const updated = await this.prisma.request.update({
      where: { request_id: requestId },
      data: { status: 'APPROVED' },
      select: REQUEST_SELECT,
    });

    this.logger.log(
      `[Approve] request_id=${requestId} type=${request.type} by=${actorId}`,
    );
    this.notificationsService.create(request.employee_id, {
      title: `${request.type} Request Approved`,
      content: `Your ${request.type.toLowerCase()} request for ${this.formatDate(request.date)} has been approved.`,
      type: 'REQUEST_APPROVED',
      referenceId: request.request_id,
    });
    return this.formatRequest(updated);
  }

  // PLACEHOLDER_APPROVE_EXPLANATION

  private async approveExplanation(request: any) {
    const STANDARD_WORK_SECONDS = 28800;

    const result = await this.prisma.$transaction(async (tx) => {
      if (!request.attendance_id || !request.end_time) {
        throw new BadRequestException(
          'Explanation request is missing attendance or end time.',
        );
      }

      const updated = await tx.request.update({
        where: { request_id: request.request_id },
        data: { status: 'APPROVED' },
        select: REQUEST_SELECT,
      });

      const attendance = await tx.dailyAttendance.findUnique({
        where: { attendance_id: request.attendance_id },
      });
      if (!attendance?.checkin_time) {
        throw new BadRequestException(
          'Attendance record is unavailable for recalculation.',
        );
      }

      const dayOfWeek = dateOnlyDayOfWeek(attendance.date);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Re-check OT approval for this day so weekend-with-OT and weekday-with-OT
      // both lift the 18:30 cap and deduct dinner overlap correctly.
      const approvedOt = await tx.request.findFirst({
        where: {
          employee_id: request.employee_id,
          type: 'OT',
          status: 'APPROVED',
          date: attendance.date,
        },
        select: { request_id: true },
      });
      const otApproved = approvedOt !== null;

      const checkinSec = toSecondsOfDay(attendance.checkin_time)!;
      const endTimeSec = toSecondsOfDay(request.end_time)!;
      const credit = computeStandardCredit(
        checkinSec,
        endTimeSec,
        otApproved,
        isWeekend,
      );
      const workedSeconds = credit * STANDARD_WORK_SECONDS;
      const missingMinutes =
        isWeekend && !otApproved
          ? 0
          : Math.max(
              0,
              Math.round((STANDARD_WORK_SECONDS - workedSeconds) / 60),
            );
      const status: 'COMPLETED' | 'SHORTHOURS' | 'WEEKEND' =
        isWeekend && !otApproved
          ? 'WEEKEND'
          : credit >= 1
            ? 'COMPLETED'
            : 'SHORTHOURS';

      await tx.dailyAttendance.update({
        where: { attendance_id: request.attendance_id },
        data: {
          checkout_time: request.end_time,
          total_workday: credit,
          missing_minutes: missingMinutes,
          status,
        },
      });

      const monthYear = this.toMonthYear(request.date);
      await tx.monthlyLimit.upsert({
        where: {
          employee_id_month_year: {
            employee_id: request.employee_id,
            month_year: monthYear,
          },
        },
        create: {
          employee_id: request.employee_id,
          month_year: monthYear,
          explanation_count: 0,
        },
        update: {},
      });
      const consumed = await tx.monthlyLimit.updateMany({
        where: {
          employee_id: request.employee_id,
          month_year: monthYear,
          explanation_count: { lt: 2 },
        },
        data: { explanation_count: { increment: 1 } },
      });
      if (consumed.count !== 1) {
        throw new BadRequestException(
          'Monthly explanation limit reached (2/2).',
        );
      }

      return updated;
    });

    this.logger.log(
      `[ApproveExplanation] request_id=${request.request_id} attendance recalculated`,
    );
    this.notificationsService.create(request.employee_id, {
      title: 'Explanation Request Approved',
      content: `Your explanation request for ${this.formatDate(request.date)} has been approved. Attendance recalculated.`,
      type: 'REQUEST_APPROVED',
      referenceId: request.request_id,
    });
    return this.formatRequest(result);
  }

  async rejectRequest(requestId: number, actorId: number, actorRole: string) {
    this.assertManager(actorRole);

    const request = await this.prisma.request.findUnique({
      where: { request_id: requestId },
    });
    if (!request) throw new NotFoundException('Request not found.');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only PENDING requests can be rejected.');
    }

    const updated = await this.prisma.request.update({
      where: { request_id: requestId },
      data: { status: 'REJECTED' },
      select: REQUEST_SELECT,
    });

    this.logger.log(
      `[Reject] request_id=${requestId} type=${request.type} by=${actorId}`,
    );
    this.notificationsService.create(request.employee_id, {
      title: `${request.type} Request Rejected`,
      content: `Your ${request.type.toLowerCase()} request for ${this.formatDate(request.date)} has been rejected.`,
      type: 'REQUEST_REJECTED',
      referenceId: request.request_id,
    });
    return this.formatRequest(updated);
  }

  private assertManager(actorRole: string) {
    if (actorRole !== 'MANAGER') {
      throw new ForbiddenException(
        'Only Manager users can perform this action.',
      );
    }
  }

  private todayDate(): Date {
    return businessDateFromInstant(new Date());
  }

  private parseDateString(iso: string): Date {
    return dateOnlyFromIso(iso);
  }

  private addDays(base: Date, days: number): Date {
    return addDateOnlyDays(base, days);
  }

  private toMonthYear(date: Date): string {
    return formatDateOnly(date).slice(0, 7);
  }

  private parseTimeToDate(time: string): Date {
    return timeOnlyFromString(time);
  }

  private formatRequest(row: any) {
    return {
      ...row,
      attendance_id: row.attendance_id ? row.attendance_id.toString() : null,
      date: this.formatDate(row.date),
      start_time: row.start_time ? this.formatTime(row.start_time) : null,
      end_time: row.end_time ? this.formatTime(row.end_time) : null,
      created_at: row.created_at?.toISOString?.() ?? row.created_at,
      updated_at: row.updated_at?.toISOString?.() ?? row.updated_at,
    };
  }

  private formatDate(d: Date): string {
    return formatDateOnly(d);
  }

  private formatTime(d: Date): string {
    return formatTimeOnly(d);
  }
}
