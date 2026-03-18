import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService],
  // Export EmployeesService so AuthModule can call findByUsername() during login
  exports: [EmployeesService],
})
export class EmployeesModule {}
