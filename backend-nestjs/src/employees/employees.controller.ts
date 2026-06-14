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
import { AssignRfidDto } from './dto/assign-rfid.dto';
import { RemoveCredentialsDto } from './dto/remove-credentials.dto';
import { QueryEmployeeDto } from './dto/query-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles('MANAGER')
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Get()
  @Roles('MANAGER')
  findAll(@Query() query: QueryEmployeeDto) {
    return this.employeesService.findAll({
      page: Number(query.page ?? 1),
      limit: Number(query.limit ?? 10),
      search: query.search ?? '',
    });
  }

  @Get('unassigned-credentials')
  @Roles('MANAGER')
  findUnassignedCredentials(@Query() query: QueryEmployeeDto) {
    return this.employeesService.findUnassignedCredentials({
      page: Number(query.page ?? 1),
      limit: Number(query.limit ?? 10),
      search: query.search ?? '',
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.findById(id);
  }

  @Patch(':id')
  @Roles('MANAGER')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.updateProfile(id, dto);
  }

  @Patch(':id/credentials/rfid')
  @Roles('MANAGER')
  assignRfid(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignRfidDto,
  ) {
    return this.employeesService.assignRfid(id, dto.rfid_tag);
  }

  @Patch(':id/reset-password')
  @Roles('MANAGER')
  resetPassword(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.resetPassword(id);
  }

  @Delete(':id/credentials')
  @Roles('MANAGER')
  removeCredentials(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: RemoveCredentialsDto,
  ) {
    return this.employeesService.removeCredentialIdentifier(id, query.type);
  }

  @Delete(':id')
  @Roles('MANAGER')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.softDeleteEmployee(id);
  }
}
