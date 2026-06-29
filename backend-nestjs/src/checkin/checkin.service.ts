import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CheckinDto } from './dto/checkin.dto';
import {
  businessDateFromInstant,
  businessTimeFromInstant,
  formatDateOnly,
  formatTimeOnly,
} from '../common/vietnam-time';

/**
 * Response shape returned to the firmware.
 *
 * - status=ok: log and DailyAttendance updated.
 * - status=invalid_credential: firmware must delete the ghost template locally.
 */
export type CheckinResponse =
  | {
      status: 'ok';
      kind: 'CHECKIN' | 'CHECKOUT';
      employee_id: number;
      employee_name: string;
      timestamp: string;
    }
  | {
      status: 'invalid_credential';
      action?: 'FORCE_DELETE_LOCAL';
      local_id?: number;
    };

@Injectable()
export class CheckinService {
  private readonly logger = new Logger(CheckinService.name);

  /**
   * Late-night scans before 04:00 belong to the previous calendar day as per
   * Timekeeping.md §2.2 "Midnight crossing".
   */
  private static readonly MIDNIGHT_GRACE_HOUR = 4;

  constructor(private readonly prisma: PrismaService) {}

  async handle(dto: CheckinDto): Promise<CheckinResponse> {
    const now = new Date();
    const { mac_addr, auth_method, fingerprint_id, rfid_tag, client_tx_id } =
      dto;

    if (auth_method === 'FINGERPRINT' && !fingerprint_id) {
      throw new BadRequestException(
        'fingerprint_id is required for FINGERPRINT checkin.',
      );
    }

    if (auth_method === 'RFID' && !rfid_tag) {
      throw new BadRequestException('rfid_tag is required for RFID checkin.');
    }

    const device = await this.prisma.device.findUnique({
      where: { mac_addr },
      select: { device_id: true, status: true },
    });

    if (!device) {
      throw new NotFoundException(`Device ${mac_addr} not found.`);
    }

    if (device.status !== 'ACTIVE') {
      throw new ForbiddenException(`Device ${mac_addr} is not ACTIVE.`);
    }

    let employeeId = 0;

    if (auth_method === 'FINGERPRINT') {
      const mapping = await this.prisma.mapping.findUnique({
        where: {
          device_id_fingerprint_id: {
            device_id: device.device_id,
            fingerprint_id: fingerprint_id!,
          },
        },
        select: { employee_id: true },
      });

      if (!mapping) {
        this.logger.warn(
          `[Checkin] Ghost credential device=${device.device_id} fp=${fingerprint_id} → FORCE_DELETE_LOCAL`,
        );
        return {
          status: 'invalid_credential',
          action: 'FORCE_DELETE_LOCAL',
          local_id: fingerprint_id!,
        };
      }

      employeeId = mapping.employee_id;
    } else {
      const employee = await this.prisma.employee.findUnique({
        where: { rfid_tag: rfid_tag! },
        select: { employee_id: true, full_name: true },
      });

      if (!employee) {
        this.logger.warn(`[Checkin] Unknown RFID tag=${rfid_tag}`);
        return {
          status: 'invalid_credential',
        };
      }

      employeeId = employee.employee_id;
    }

    const targetDate = this.resolveAttendanceDate(now);
    const attendanceTime = businessTimeFromInstant(now);

    return this.prisma.$transaction(async (tx) => {
      // 1. Idempotent insert. `sync_hash` is @unique → a retry from firmware
      //    with the same client_tx_id short-circuits back to the original row.
      try {
        await tx.checkInLog.create({
          data: {
            employee_id: employeeId,
            device_id: device.device_id,
            timestamp: now,
            auth_method,
            sync_hash: client_tx_id,
          },
        });
      } catch (err) {
        if (
          err instanceof PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          this.logger.log(
            `[Checkin] Idempotent retry employee=${employeeId} tx=${client_tx_id}`,
          );
          const existing = await tx.checkInLog.findUnique({
            where: { sync_hash: client_tx_id },
            select: { employee_id: true, timestamp: true },
          });
          if (existing) {
            const employee = await tx.employee.findUnique({
              where: { employee_id: existing.employee_id },
              select: { full_name: true },
            });
            const attendance = await tx.dailyAttendance.findUnique({
              where: {
                employee_id_date: {
                  employee_id: existing.employee_id,
                  date: this.resolveAttendanceDate(existing.timestamp),
                },
              },
              select: { checkout_time: true },
            });
            return {
              status: 'ok' as const,
              kind: attendance?.checkout_time
                ? ('CHECKOUT' as const)
                : ('CHECKIN' as const),
              employee_id: existing.employee_id,
              employee_name: employee?.full_name ?? '',
              timestamp: existing.timestamp.toISOString(),
            };
          }
        }
        throw err;
      }

      // 2. Upsert DailyAttendance. First scan of the day = checkin; later
      //    scans overwrite checkout_time so it always reflects the latest.
      const attendance = await tx.dailyAttendance.findUnique({
        where: {
          employee_id_date: {
            employee_id: employeeId,
            date: targetDate,
          },
        },
        select: { checkin_time: true },
      });

      let kind: 'CHECKIN' | 'CHECKOUT';
      if (!attendance || !attendance.checkin_time) {
        kind = 'CHECKIN';
        await tx.dailyAttendance.upsert({
          where: {
            employee_id_date: {
              employee_id: employeeId,
              date: targetDate,
            },
          },
          create: {
            employee_id: employeeId,
            date: targetDate,
            checkin_time: attendanceTime,
          },
          update: {
            checkin_time: attendanceTime,
          },
        });
      } else {
        kind = 'CHECKOUT';
        await tx.dailyAttendance.update({
          where: {
            employee_id_date: {
              employee_id: employeeId,
              date: targetDate,
            },
          },
          data: { checkout_time: attendanceTime },
        });
      }

      const employee = await tx.employee.findUnique({
        where: { employee_id: employeeId },
        select: { full_name: true },
      });

      this.logger.log(
        `[Checkin] kind=${kind} employee=${employeeId} device=${device.device_id} instant=${now.toISOString()} business_date=${formatDateOnly(targetDate)} business_time=${formatTimeOnly(attendanceTime, true)}`,
      );

      return {
        status: 'ok' as const,
        kind,
        employee_id: employeeId,
        employee_name: employee?.full_name ?? '',
        timestamp: now.toISOString(),
      };
    });
  }

  /**
   * Scans between 00:00 and 04:00 without a previous checkout map to the
   * previous calendar day (see Timekeeping.md §2.2). For this endpoint we do
   * not look back at yesterday's record — the assumption is: if the scan is
   * before the grace hour, attribute it to yesterday. The batch calculator
   * handles reconciliation.
   */
  private resolveAttendanceDate(at: Date): Date {
    return businessDateFromInstant(at, CheckinService.MIDNIGHT_GRACE_HOUR);
  }
}
