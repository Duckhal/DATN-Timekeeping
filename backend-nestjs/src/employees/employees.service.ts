import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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

    // FINGERPRINT: clear master template AND all per-device mappings
    return this.prisma.$transaction(async (tx) => {
      await tx.mapping.deleteMany({ where: { employee_id: empId } });
      return tx.employee.update({
        where: { employee_id: empId },
        data: { template_fingerprint: null },
        select: SAFE_SELECT,
      });
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
      template_fingerprint: employee.template_fingerprint,
      created_at: employee.created_at,
      updated_at: employee.updated_at,
    };
  }
}
