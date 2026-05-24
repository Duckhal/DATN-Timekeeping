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
  manager_id: true,
  manager: { select: { employee_id: true, email: true, full_name: true } },
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

  async findAll() {
    return this.prisma.employee.findMany({
      select: SAFE_SELECT,
      orderBy: { employee_id: 'asc' },
    });
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
      manager_id: employee.manager_id,
      manager: employee.manager ?? null,
      created_at: employee.created_at,
      updated_at: employee.updated_at,
    };
  }
}
