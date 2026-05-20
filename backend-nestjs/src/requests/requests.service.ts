import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOtRequestDto } from './dto/create-ot-request.dto';
import { CreateExplanationRequestDto } from './dto/create-explanation-request.dto';
import { QueryRequestsDto } from './dto/query-requests.dto';
import {
  computeStandardCredit,
  toSecondsOfDay,
} from '../attendance/attendance.compute';
import type { RequestStatus } from '../types/enums';

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

const PENDING_SELECT = {
  ...REQUEST_SELECT,
  employee: { select: { full_name: true, email: true } },
};

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createOtRequest(employeeId: number, dto: CreateOtRequestDto) {
    const today = this.todayDate();

    const existing = await this.prisma.request.findFirst({
      where: {
        employee_id: employeeId,
        type: 'OT',
        status: 'PENDING',
        date: today,
      },
    });
    if (existing) {
      throw new BadRequestException('You already have a pending OT request for today.');
    }

    const request = await this.prisma.request.create({
      data: {
        employee_id: employeeId,
        type: 'OT',
        date: today,
        reason: dto.reason,
      },
      select: REQUEST_SELECT,
    });

    this.logger.log(`[CreateOT] employee=${employeeId} request_id=${request.request_id}`);
    return this.formatRequest(request);
  }

  async createExplanationRequest(employeeId: number, dto: CreateExplanationRequestDto) {
    const attendance = await this.prisma.dailyAttendance.findUnique({
      where: { attendance_id: BigInt(dto.attendance_id) },
    });
    if (!attendance) {
      throw new NotFoundException('Attendance record not found.');
    }
    if (attendance.employee_id !== employeeId) {
      throw new ForbiddenException('This attendance record does not belong to you.');
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
      where: { employee_id_month_year: { employee_id: employeeId, month_year: monthYear } },
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
      throw new BadRequestException('An explanation request already exists for this day.');
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
        throw new BadRequestException('This day has an approved OT request. Please provide end_time.');
      }
      endTime = this.parseTimeToDate('17:30');
    }

    const request = await this.prisma.$transaction(async (tx) => {
      await tx.monthlyLimit.upsert({
        where: { employee_id_month_year: { employee_id: employeeId, month_year: monthYear } },
        create: { employee_id: employeeId, month_year: monthYear, explanation_count: 1 },
        update: { explanation_count: { increment: 1 } },
      });

      return tx.request.create({
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
    });

    this.logger.log(`[CreateExplanation] employee=${employeeId} request_id=${request.request_id} attendance_id=${dto.attendance_id}`);
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

    return { items: rows.map((r) => this.formatRequest(r)), page, pageSize, total };
  }

  async findPendingForManager(actorId: number, actorRole: string, query: QueryRequestsDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);

    const where: any = { status: 'PENDING' as RequestStatus };
    if (query.type) where.type = query.type;

    if (actorRole === 'HR') {
      // HR sees all pending
    } else {
      where.employee = { manager_id: actorId };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.request.count({ where }),
      this.prisma.request.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: PENDING_SELECT,
      }),
    ]);

    return { items: rows.map((r) => this.formatRequest(r)), page, pageSize, total };
  }

  async approveRequest(requestId: number, actorId: number, actorRole: string) {
    const request = await this.prisma.request.findUnique({
      where: { request_id: requestId },
      include: { employee: { select: { manager_id: true } } },
    });
    if (!request) throw new NotFoundException('Request not found.');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only PENDING requests can be approved.');
    }

    this.authorizeManager(request.employee.manager_id, actorId, actorRole);

    if (request.type === 'EXPLANATION') {
      return this.approveExplanation(request);
    }

    const updated = await this.prisma.request.update({
      where: { request_id: requestId },
      data: { status: 'APPROVED' },
      select: REQUEST_SELECT,
    });

    this.logger.log(`[Approve] request_id=${requestId} type=${request.type} by=${actorId}`);
    return this.formatRequest(updated);
  }

  // PLACEHOLDER_APPROVE_EXPLANATION

  private async approveExplanation(request: any) {
    const STANDARD_WORK_SECONDS = 28800;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.request.update({
        where: { request_id: request.request_id },
        data: { status: 'APPROVED' },
        select: REQUEST_SELECT,
      });

      if (request.attendance_id) {
        const attendance = await tx.dailyAttendance.findUnique({
          where: { attendance_id: request.attendance_id },
        });

        if (attendance && attendance.checkin_time) {
          const checkinSec = toSecondsOfDay(attendance.checkin_time)!;
          const endTimeSec = toSecondsOfDay(request.end_time)!;
          const credit = computeStandardCredit(checkinSec, endTimeSec);
          const workedSeconds = credit * STANDARD_WORK_SECONDS;
          const missingMinutes = Math.max(0, Math.round((STANDARD_WORK_SECONDS - workedSeconds) / 60));
          const status = credit >= 1 ? 'COMPLETED' : 'SHORTHOURS';

          await tx.dailyAttendance.update({
            where: { attendance_id: request.attendance_id },
            data: {
              checkout_time: request.end_time,
              total_workday: credit,
              missing_minutes: missingMinutes,
              status,
            },
          });
        }
      }

      return updated;
    });

    this.logger.log(`[ApproveExplanation] request_id=${request.request_id} attendance recalculated`);
    return this.formatRequest(result);
  }

  async rejectRequest(requestId: number, actorId: number, actorRole: string) {
    const request = await this.prisma.request.findUnique({
      where: { request_id: requestId },
      include: { employee: { select: { manager_id: true } } },
    });
    if (!request) throw new NotFoundException('Request not found.');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only PENDING requests can be rejected.');
    }

    this.authorizeManager(request.employee.manager_id, actorId, actorRole);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.request.update({
        where: { request_id: requestId },
        data: { status: 'REJECTED' },
        select: REQUEST_SELECT,
      });

      if (request.type === 'EXPLANATION') {
        const monthYear = this.toMonthYear(request.date);
        await tx.monthlyLimit.updateMany({
          where: { employee_id: request.employee_id, month_year: monthYear, explanation_count: { gt: 0 } },
          data: { explanation_count: { decrement: 1 } },
        });
      }

      return result;
    });

    this.logger.log(`[Reject] request_id=${requestId} type=${request.type} by=${actorId}`);
    return this.formatRequest(updated);
  }

  private authorizeManager(employeeManagerId: number | null, actorId: number, actorRole: string) {
    if (actorRole === 'HR') return;
    if (employeeManagerId !== actorId) {
      throw new ForbiddenException('You are not the manager of this employee.');
    }
  }

  private todayDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private toMonthYear(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private parseTimeToDate(time: string): Date {
    const [h, m] = time.split(':').map(Number);
    const d = new Date(1970, 0, 1, h, m, 0, 0);
    return d;
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
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private formatTime(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
