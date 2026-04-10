import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { MapFingerprintDto } from './dto/map-fingerprint.dto';
import { AssignRfidDto } from './dto/assign-rfid.dto';
import { ConfirmFingerprintDto } from './dto/confirm-fingerprint.dto';
import { RemoveCredentialsDto } from './dto/remove-credentials.dto';
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

  // UC0b — HR maps a fingerprint credential ID to an employee
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

  @Get('unassigned-credentials')
  @Roles('HR')
  findUnassignedCredentials() {
    return this.employeesService.findUnassignedCredentials();
  }

  // Single employee — accessible to authenticated employees (own profile or HR)
  // Protected by global JwtAuthGuard inherently, no specific role needed
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.findById(id);
  }

  @Patch(':id/credentials/rfid')
  @Roles('HR')
  assignRfid(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignRfidDto,
  ) {
    return this.employeesService.assignRfid(id, dto.rfid_tag);
  }

  @Patch(':id/credentials/fingerprint')
  @Roles('HR')
  confirmFingerprint(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmFingerprintDto,
  ) {
    return this.employeesService.confirmFingerprintFromCache(id, dto.device_id);
  }

  @Delete(':id/credentials')
  @Roles('HR')
  removeCredentials(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: RemoveCredentialsDto,
  ) {
    return this.employeesService.removeCredentialIdentifier(id, query.type);
  }
}
