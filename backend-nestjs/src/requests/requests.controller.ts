import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateOtRequestDto } from './dto/create-ot-request.dto';
import { CreateExplanationRequestDto } from './dto/create-explanation-request.dto';
import { QueryRequestsDto } from './dto/query-requests.dto';
import { Roles } from '../auth/decorators/roles.decorator';

type JwtRequest = { user: { employee_id: number; role: string } };

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post('ot')
  createOt(@Req() req: JwtRequest, @Body() dto: CreateOtRequestDto) {
    return this.requestsService.createOtRequest(req.user.employee_id, dto);
  }

  @Post('explanation')
  createExplanation(@Req() req: JwtRequest, @Body() dto: CreateExplanationRequestDto) {
    return this.requestsService.createExplanationRequest(req.user.employee_id, dto);
  }

  @Get('me')
  findMine(@Req() req: JwtRequest, @Query() query: QueryRequestsDto) {
    return this.requestsService.findByEmployee(req.user.employee_id, query);
  }

  @Get('pending')
  @Roles('MANAGER')
  findPending(@Req() req: JwtRequest, @Query() query: QueryRequestsDto) {
    return this.requestsService.findPendingForManager(req.user.role, query);
  }

  @Patch(':id/approve')
  @Roles('MANAGER')
  approve(@Req() req: JwtRequest, @Param('id', ParseIntPipe) id: number) {
    return this.requestsService.approveRequest(id, req.user.employee_id, req.user.role);
  }

  @Patch(':id/reject')
  @Roles('MANAGER')
  reject(@Req() req: JwtRequest, @Param('id', ParseIntPipe) id: number) {
    return this.requestsService.rejectRequest(id, req.user.employee_id, req.user.role);
  }
}
