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

// NOTE: Route guards (@Roles, @JwtAuthGuard) will be applied in Phase 3 (Auth Module).
// For now, all routes are accessible — do NOT deploy until Phase 3 is complete.
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  // UC0b — HR creates a new employee account
  // Phase 3 will add: @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.HR)
  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  // UC0b — HR maps a fingerprint hardware ID to an employee
  // Phase 3 will add: @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.HR)
  @Patch(':id/fingerprint')
  mapFingerprint(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MapFingerprintDto,
  ) {
    return this.employeesService.mapFingerprint(id, dto);
  }

  // HR dashboard — list all employees
  // Phase 3 will add: @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.HR)
  @Get()
  findAll() {
    return this.employeesService.findAll();
  }

  // Single employee — accessible to authenticated employees (own profile or HR)
  // Phase 3 will add: @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.findById(id);
  }
}
