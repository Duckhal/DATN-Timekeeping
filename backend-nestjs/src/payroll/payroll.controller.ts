import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  StreamableFile,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { PublishPayrollDto } from './dto/publish-payroll.dto';
import { PayrollService } from './payroll.service';

type JwtRequest = {
  user: {
    employee_id: number;
    role: 'MANAGER' | 'EMPLOYEE';
  };
};

@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('publish')
  @Roles('MANAGER')
  publish(@Body() dto: PublishPayrollDto) {
    return this.payrollService.publishMonthlyPayroll(dto.month);
  }

  @Get(':id')
  findOne(@Req() req: JwtRequest, @Param('id', ParseIntPipe) id: number) {
    return this.payrollService.findPayrollForActor(id, req.user);
  }

  @Get(':id/pdf')
  async getPdf(
    @Req() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const file = await this.payrollService.getPayrollPdfFile(id, req.user);

    return new StreamableFile(file.stream, {
      type: 'application/pdf',
      disposition: `inline; filename="${file.filename}"`,
    });
  }
}
