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
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles('HR')
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

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

  @Patch(':id/reset-password')
  @Roles('HR')
  resetPassword(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.resetPassword(id);
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
