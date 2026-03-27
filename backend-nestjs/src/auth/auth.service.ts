import { Injectable, UnauthorizedException } from '@nestjs/common';
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
    const employee = await this.employeesService.findByUsername(loginDto.account_username);
    
    // Explicit generic error message to prevent user enumeration
    if (!employee) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(employee.password_hash, loginDto.password);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { 
      sub: employee.emp_id, 
      username: employee.account_username,
      role: employee.role 
    };
    
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
