import { Controller, Get, ParseIntPipe, Param, Query, Req } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { QueryAllAttendanceDto } from './dto/query-all-attendance.dto';
import { Roles } from '../auth/decorators/roles.decorator';

type JwtRequest = {
  user: {
    employee_id: number;
    role: 'HR' | 'EMPLOYEE';
  };
};

@Controller()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // Employee — read own attendance. JWT-protected by global guard.
  @Get('attendance/me')
  findMine(@Req() req: JwtRequest, @Query() query: QueryAttendanceDto) {
    return this.attendanceService.listForEmployee(req.user.employee_id, query);
  }

  // Employee — list past days with missing checkout (for explanation form).
  @Get('attendance/me/missing-checkout')
  findMissingCheckout(@Req() req: JwtRequest) {
    return this.attendanceService.findMissingCheckoutDays(req.user.employee_id);
  }

  // HR — paginated attendance log for all employees.
  @Get('attendance/all')
  @Roles('HR')
  findAllEmployeeAttendance(@Query() query: QueryAllAttendanceDto) {
    return this.attendanceService.listAllEmployeeAttendance(query);
  }

  // HR — monthly aggregate (total missing_minutes + total_workday) for the
  // employee(s) matching the `search` term within the resolved date range.
  @Get('attendance/all/summary')
  @Roles('HR')
  summarizeAllEmployeeAttendance(@Query() query: QueryAllAttendanceDto) {
    return this.attendanceService.summarizeEmployeeAttendance(query);
  }

  // HR — read attendance for any employee.
  @Get('employees/:id/attendance')
  @Roles('HR')
  findForEmployee(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryAttendanceDto,
  ) {
    return this.attendanceService.listForEmployee(id, query);
  }
}
