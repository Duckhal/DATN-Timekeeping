import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EmployeesService } from '../employees/employees.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as argon2 from 'argon2';

@Injectable()
export class AuthService {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async login(loginDto: LoginDto) {
    const employee = await this.employeesService.findByEmail(loginDto.email);

    if (!employee) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(
      employee.password_hash,
      loginDto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (employee.must_change_password) {
      const payload = {
        employee_id: employee.employee_id,
        email: employee.email,
        role: employee.role,
        sub: employee.employee_id,
        scope: 'password_change',
      };

      return {
        access_token: await this.jwtService.signAsync(payload, {
          expiresIn: '10m',
        }),
        must_change_password: true,
        user: {
          employee_id: employee.employee_id,
          full_name: employee.full_name,
        },
      };
    }

    const payload = {
      employee_id: employee.employee_id,
      email: employee.email,
      role: employee.role,
      sub: employee.employee_id,
      scope: 'full',
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: this.employeesService.toPublicEmployee(employee),
    };
  }

  async changePassword(employeeId: number, dto: ChangePasswordDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { employee_id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const isCurrentValid = await argon2.verify(
      employee.password_hash,
      dto.current_password,
    );

    if (!isCurrentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await argon2.hash(dto.new_password);

    const updated = await this.prisma.employee.update({
      where: { employee_id: employeeId },
      data: {
        password_hash: newHash,
        must_change_password: false,
      },
    });

    const payload = {
      employee_id: updated.employee_id,
      email: updated.email,
      role: updated.role,
      sub: updated.employee_id,
      scope: 'full',
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: this.employeesService.toPublicEmployee(updated),
    };
  }

  async me(employeeId: number) {
    const profile = await this.employeesService.findById(employeeId);

    if (!profile) {
      throw new NotFoundException('Employee profile not found');
    }

    return this.employeesService.toPublicEmployee(profile);
  }
}
