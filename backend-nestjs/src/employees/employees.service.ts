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

// Fields returned in all public-facing responses — password_hash is never included
const SAFE_SELECT = {
  employee_id: true,
  email: true,
  full_name: true,
  role: true,
  date_of_birth: true,
  hourly_rate: true,
  rfid_tag: true,
  template_fingerprint: true,
  created_at: true,
  updated_at: true,
};

type EmployeeSafe = Omit<PublicEmployeeProfile, 'hourly_rate'> & {
  hourly_rate: unknown;
};

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqttService: MqttService,
  ) {}

  // UC0b — HR creates a new employee account
  async create(dto: CreateEmployeeDto) {
    const password_hash = await argon2.hash(dto.password);

    try {
      return await this.prisma.employee.create({
        data: {
          email: dto.email,
          password_hash,
          full_name: dto.full_name,
          role: dto.role,
          hourly_rate: dto.hourly_rate,
        },
        select: SAFE_SELECT,
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(
          `email "${dto.email}" is already taken.`,
        );
      }
      throw err;
    }
  }

  // HR dashboard — list all employees (no password_hash)
  async findAll() {
    return this.prisma.employee.findMany({ select: SAFE_SELECT });
  }

  async findUnassignedCredentials() {
    return this.prisma.employee.findMany({
      where: {
        OR: [{ rfid_tag: null }, { template_fingerprint: null }],
      },
      select: SAFE_SELECT,
      orderBy: { employee_id: 'asc' },
    });
  }

  // Single employee lookup — used by employee's own profile view
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

  // Internal-only — used by AuthService for login (includes password_hash)
  async findByUsername(username: string) {
    return this.prisma.employee.findUnique({
      where: { email: username },
      // NOTE: intentionally returns full record with password_hash — auth use only
    });
  }

  // Internal-only — alias for auth login semantics where username is an email.
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

  async removeCredentialIdentifier(empId: number, type: AuthMethod) {
    await this.findById(empId);

    if (type === 'RFID') {
      return this.prisma.employee.update({
        where: { employee_id: empId },
        data: { rfid_tag: null },
        select: SAFE_SELECT,
      });
    }

    // FINGERPRINT removal is split in two phases so MQTT publishing can never
    // run inside a DB transaction (it is not rollback-able).
    //
    // Phase 1 (transactional, authoritative):
    //   - Snapshot every (device mac, local fingerprint slot) that will be
    //     orphaned, then delete mappings + clear the master template.
    //
    // Phase 2 (post-commit, fire-and-forget):
    //   - Publish DELETE_FINGER to each device's private command topic.
    //   - Offline devices miss this message, but the self-healing ghost path
    //     in the check-in endpoint will clean them up later.
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

  // Shared mapper for API contracts that expose `email` and `employee_id` fields.
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
      created_at: employee.created_at,
      updated_at: employee.updated_at,
    };
  }
}
