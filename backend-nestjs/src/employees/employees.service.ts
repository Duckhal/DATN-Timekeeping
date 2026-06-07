import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from '../mqtt/mqtt.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { AuthMethod, PublicEmployeeProfile } from '../types';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client/scripts/default-index.js';

const SAFE_SELECT = {
  employee_id: true,
  email: true,
  full_name: true,
  role: true,
  date_of_birth: true,
  hourly_rate: true,
  rfid_tag: true,
  template_fingerprint: true,
  must_change_password: true,
  is_active: true,
  manager_id: true,
  manager: { select: { employee_id: true, email: true, full_name: true } },
  created_at: true,
  updated_at: true,
};

type EmployeeSafe = Omit<PublicEmployeeProfile, 'hourly_rate' | 'is_active'> & {
  hourly_rate: unknown;
  is_active: boolean;
};

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqttService: MqttService,
  ) {}

  private generatePassword(length = 8): string {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    const bytes = crypto.randomBytes(length);
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset[bytes[i] % charset.length];
    }
    return password;
  }

  async create(dto: CreateEmployeeDto, creatorId: number) {
    const generatedPassword = this.generatePassword();
    const password_hash = await argon2.hash(generatedPassword);

    try {
      const employee = await this.prisma.employee.create({
        data: {
          email: dto.email,
          password_hash,
          full_name: dto.full_name,
          role: dto.role,
          hourly_rate: dto.hourly_rate,
          date_of_birth: dto.date_of_birth
            ? new Date(dto.date_of_birth)
            : undefined,
          must_change_password: true,
          manager_id: creatorId,
        },
        select: SAFE_SELECT,
      });

      return {
        ...this.toPublicEmployee(employee),
        generated_password: generatedPassword,
      };
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(
          `email "${dto.email}" is already taken.`,
        );
      }
      throw err;
    }
  }

  async findAll(query: { page: number; limit: number; search: string }) {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    // Filter out deactivated accounts by forcing is_active to be true
    const where: any = {
      is_active: true,
      ...(search
        ? {
            OR: [
              { full_name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        select: SAFE_SELECT,
        orderBy: { employee_id: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      items: items.map((emp) => this.toPublicEmployee(emp)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findUnassignedCredentials(query: { page: number; limit: number; search: string }) {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    // Only get active staff members for authorization mapping
    const where: any = {
      is_active: true,
      ...(search
        ? {
            OR: [
              { full_name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { rfid_tag: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        select: SAFE_SELECT,
        orderBy: { employee_id: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      items: items.map((emp) => this.toPublicEmployee(emp)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(empId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { employee_id: empId },
      select: SAFE_SELECT,
    });
    if (!employee) {
      throw new NotFoundException(`Employee with id ${empId} not found.`);
    }
    return employee;
  }

  async findByUsername(username: string) {
    return this.prisma.employee.findUnique({
      where: { email: username },
      select: { ...SAFE_SELECT, password_hash: true },
    });
  }

  async findByEmail(email: string) {
    return this.findByUsername(email);
  }

  async assignRfid(empId: number, rfidTag: string) {
    await this.findById(empId);

    try {
      return await this.prisma.employee.update({
        where: { employee_id: empId },
        data: { rfid_tag: rfidTag },
        select: SAFE_SELECT,
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`rfid_tag "${rfidTag}" is already assigned.`);
      }
      throw err;
    }
  }

  async resetPassword(empId: number) {
    await this.findById(empId);

    const generatedPassword = this.generatePassword();
    const password_hash = await argon2.hash(generatedPassword);

    const employee = await this.prisma.employee.update({
      where: { employee_id: empId },
      data: { password_hash, must_change_password: true },
      select: SAFE_SELECT,
    });

    this.logger.log(`[ResetPassword] employee=${empId} password reset by HR`);

    return {
      ...this.toPublicEmployee(employee),
      generated_password: generatedPassword,
    };
  }

  async removeCredentialIdentifier(empId: number, type: AuthMethod) {
    await this.findById(empId);

    if (type === 'RFID') {
      return this.prisma.employee.update({
        where: { employee_id: empId },
        data: { rfid_tag: null },
        select: SAFE_SELECT,
      });
    }

    const { updated, targets } = await this.prisma.$transaction(async (tx) => {
      const mappings = await tx.mapping.findMany({
        where: {
          employee_id: empId,
          fingerprint_id: { not: null },
        },
        select: {
          fingerprint_id: true,
          device: { select: { mac_addr: true } },
        },
      });

      await tx.mapping.deleteMany({ where: { employee_id: empId } });

      const updated = await tx.employee.update({
        where: { employee_id: empId },
        data: { template_fingerprint: null },
        select: SAFE_SELECT,
      });

      const targets = mappings
        .filter((m) => m.fingerprint_id !== null && m.device?.mac_addr)
        .map((m) => ({
          mac_addr: m.device!.mac_addr,
          local_id: m.fingerprint_id!,
        }));

      return { updated, targets };
    });

    for (const target of targets) {
      const topic = `timekeeping/device/${target.mac_addr}/command`;
      this.mqttService
        .publish(topic, {
          command: 'DELETE_FINGER',
          local_id: target.local_id,
        })
        .then(() => {
          this.logger.log(
            `[RemoveFingerprint] Published DELETE_FINGER to ${topic} local_id=${target.local_id}`,
          );
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `[RemoveFingerprint] Publish to ${topic} failed (will self-heal on next check-in): ${message}`,
          );
        });
    }

    return updated;
  }

  async softDeleteEmployee(empId: number) {
    // 1. Verify if the target employee profile strictly exists in the system
    await this.findById(empId);

    // 2. Execute a database transaction to wipe hardware mappings and clear templates
    const { updated, targets } = await this.prisma.$transaction(async (tx) => {
      // Collect all operational hardware device memory slot locations for this user
      const mappings = await tx.mapping.findMany({
        where: {
          employee_id: empId,
          fingerprint_id: { not: null },
        },
        select: {
          fingerprint_id: true,
          device: { select: { mac_addr: true } },
        },
      });

      // Clear all device mappings linked to this user from the relational database table
      await tx.mapping.deleteMany({ where: { employee_id: empId } });

      // Deactivate account status, release unique RFID string, and set master fingerprint data to null
      const updated = await tx.employee.update({
        where: { employee_id: empId },
        data: {
          is_active: false,
          rfid_tag: null,
          template_fingerprint: null,
        },
        select: SAFE_SELECT,
      });

      // Format safe messaging targets for out-of-transaction MQTT publishing execution
      const targets = mappings
        .filter((m) => m.fingerprint_id !== null && m.device?.mac_addr)
        .map((m) => ({
          mac_addr: m.device!.mac_addr,
          local_id: m.fingerprint_id!,
        }));

      return { updated, targets };
    });

    // 3. Broadcast asynchronous MQTT command payloads to erase physical data slots from hardware storage
    for (const target of targets) {
      const topic = `timekeeping/device/${target.mac_addr}/command`;
      this.mqttService
        .publish(topic, {
          command: 'DELETE_FINGER',
          local_id: target.local_id,
        })
        .then(() => {
          this.logger.log(
            `[SoftDelete-Hardware] Published DELETE_FINGER to ${topic} for local_id=${target.local_id}`,
          );
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `[SoftDelete-Hardware] Publish to ${topic} failed (will self-heal on device check-in): ${message}`,
          );
        });
    }

    return updated;
  }

  toPublicEmployee(employee: EmployeeSafe): PublicEmployeeProfile {
    return {
      employee_id: employee.employee_id,
      email: employee.email,
      full_name: employee.full_name,
      role: employee.role,
      date_of_birth: employee.date_of_birth,
      hourly_rate: String(employee.hourly_rate),
      rfid_tag: employee.rfid_tag,
      template_fingerprint: employee.template_fingerprint,
      must_change_password: employee.must_change_password,
      is_active: employee.is_active,
      manager_id: employee.manager_id,
      manager: employee.manager ?? null,
      created_at: employee.created_at,
      updated_at: employee.updated_at,
    };
  }
}
