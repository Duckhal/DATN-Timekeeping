import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { MapFingerprintDto } from './dto/map-fingerprint.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  // UC0b — HR creates a new employee account
  @Post()
  @Roles('HR')
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  // UC0b — HR maps a fingerprint hardware ID to an employee
  @Patch(':id/fingerprint')
  @Roles('HR')
  mapFingerprint(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MapFingerprintDto,
  ) {
    return this.employeesService.mapFingerprint(id, dto);
  }

  // HR dashboard — list all employees
  @Get()
  @Roles('HR')
  findAll() {
    return this.employeesService.findAll();
  }

  // Single employee — accessible to authenticated employees (own profile or HR)
  // Protected by global JwtAuthGuard inherently, no specific role needed
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.findById(id);
  }
}
