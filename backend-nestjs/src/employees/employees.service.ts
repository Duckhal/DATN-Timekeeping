import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { MapFingerprintDto } from './dto/map-fingerprint.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { Cache } from 'cache-manager';
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
  fingerprint_id: true,
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
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
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

  // UC0b — HR maps a fingerprint credential ID to an existing employee
  async mapFingerprint(empId: number, dto: MapFingerprintDto) {
    await this.findById(empId); // throws NotFoundException if not found

    try {
      return await this.prisma.employee.update({
        where: { employee_id: empId },
        data: { fingerprint_id: dto.fingerprint_id },
        select: SAFE_SELECT,
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(
          `fingerprint_id "${dto.fingerprint_id}" is already mapped to another employee.`,
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
        OR: [{ rfid_tag: null }, { fingerprint_id: null }],
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

  async confirmFingerprintFromCache(empId: number, deviceId: number) {
    await this.findById(empId);

    const cacheKey = this.getFingerprintEnrollCacheKey(deviceId);
    const fingerprintId = await this.cacheManager.get<string>(cacheKey);

    this.logger.log(
      `[Enroll] Confirm request empId=${empId} deviceId=${deviceId} cacheKey=${cacheKey} cacheHit=${Boolean(fingerprintId)}`,
    );

    if (!fingerprintId) {
      throw new BadRequestException('Chua nhan duoc van tay tu thiet bi');
    }

    try {
      const updatedEmployee = await this.prisma.employee.update({
        where: { employee_id: empId },
        data: { fingerprint_id: fingerprintId },
        select: SAFE_SELECT,
      });

      await this.cacheManager.del(cacheKey);

      return updatedEmployee;
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(
          `fingerprint_id "${fingerprintId}" is already assigned.`,
        );
      }
      throw err;
    }
  }

  async removeCredentialIdentifier(empId: number, type: AuthMethod) {
    await this.findById(empId);

    const data =
      type === 'RFID'
        ? { rfid_tag: null }
        : { fingerprint_id: null };

    return this.prisma.employee.update({
      where: { employee_id: empId },
      data,
      select: SAFE_SELECT,
    });
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
      fingerprint_id: employee.fingerprint_id,
      created_at: employee.created_at,
      updated_at: employee.updated_at,
    };
  }

  private getFingerprintEnrollCacheKey(deviceId: number) {
    return `enroll_finger_${deviceId}`;
  }
}
