import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';

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
      action: 'FORCE_DELETE_LOCAL';
      local_id: number;
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

  async handle(
    mac_addr: string,
    fingerprintId: number,
    clientTxId: string,
  ): Promise<CheckinResponse> {
    const now = new Date();

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

    const mapping = await this.prisma.mapping.findUnique({
      where: {
        device_id_fingerprint_id: {
          device_id: device.device_id,
          fingerprint_id: fingerprintId,
        },
      },
      select: { employee_id: true },
    });

    if (!mapping) {
      this.logger.warn(
        `[Checkin] Ghost credential device=${device.device_id} fp=${fingerprintId} → FORCE_DELETE_LOCAL`,
      );
      return {
        status: 'invalid_credential',
        action: 'FORCE_DELETE_LOCAL',
        local_id: fingerprintId,
      };
    }

    const employeeId = mapping.employee_id;
    const targetDate = this.resolveAttendanceDate(now);

    return this.prisma.$transaction(async (tx) => {
      // 1. Idempotent insert. `sync_hash` is @unique → a retry from firmware
      //    with the same client_tx_id short-circuits back to the original row.
      try {
        await tx.checkInLog.create({
          data: {
            employee_id: employeeId,
            device_id: device.device_id,
            timestamp: now,
            auth_method: 'FINGERPRINT',
            sync_hash: clientTxId,
          },
        });
      } catch (err) {
        if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
          this.logger.log(
            `[Checkin] Idempotent retry employee=${employeeId} tx=${clientTxId}`,
          );
          const existing = await tx.checkInLog.findUnique({
            where: { sync_hash: clientTxId },
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
              kind: attendance?.checkout_time ? ('CHECKOUT' as const) : ('CHECKIN' as const),
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
            checkin_time: now,
          },
          update: {
            checkin_time: now,
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
          data: { checkout_time: now },
        });
      }

      const employee = await tx.employee.findUnique({
        where: { employee_id: employeeId },
        select: { full_name: true },
      });

      this.logger.log(
        `[Checkin] ${kind} employee=${employeeId} device=${device.device_id} at ${now.toISOString()}`,
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
    const date = new Date(at);
    if (date.getHours() < CheckinService.MIDNIGHT_GRACE_HOUR) {
      date.setDate(date.getDate() - 1);
    }
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
