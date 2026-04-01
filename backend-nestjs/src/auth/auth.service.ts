import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EmployeesService } from '../employees/employees.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import * as argon2 from 'argon2';

@Injectable()
export class AuthService {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const employee = await this.employeesService.findByEmail(loginDto.email);

    // Explicit generic error message to prevent user enumeration
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

    const payload = {
      employee_id: employee.employee_id,
      email: employee.email,
      role: employee.role,
      sub: employee.employee_id,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: this.employeesService.toPublicEmployee(employee),
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
