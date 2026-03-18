import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { MapFingerprintDto } from './dto/map-fingerprint.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as argon2 from 'argon2';

// Fields returned in all public-facing responses — password_hash is never included
const SAFE_SELECT = {
  emp_id: true,
  account_username: true,
  full_name: true,
  role: true,
  hourly_rate: true,
  fingerprint_id: true,
  created_at: true,
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
          account_username: dto.account_username,
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
          `account_username "${dto.account_username}" is already taken.`,
        );
      }
      throw err;
    }
  }

  // UC0b — HR maps a fingerprint hardware ID to an existing employee
  async mapFingerprint(empId: number, dto: MapFingerprintDto) {
    await this.findById(empId); // throws NotFoundException if not found

    try {
      return await this.prisma.employee.update({
        where: { emp_id: empId },
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

  // Single employee lookup — used by employee's own profile view
  async findById(empId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { emp_id: empId },
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
      where: { account_username: username },
      // NOTE: intentionally returns full record with password_hash — auth use only
    });
  }
}
