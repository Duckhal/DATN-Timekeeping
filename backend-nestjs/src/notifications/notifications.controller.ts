import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

type JwtRequest = { user: { employee_id: number } };

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(@Req() req: JwtRequest, @Query() query: QueryNotificationsDto) {
    return this.notificationsService.findByEmployee(req.user.employee_id, query);
  }

  @Get('unread-count')
  getUnreadCount(@Req() req: JwtRequest) {
    return this.notificationsService.getUnreadCount(req.user.employee_id);
  }

  @Patch(':id/read')
  markAsRead(
    @Req() req: JwtRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notificationsService.markAsRead(id, req.user.employee_id);
  }

  @Patch('read-all')
  markAllAsRead(@Req() req: JwtRequest) {
    return this.notificationsService.markAllAsRead(req.user.employee_id);
  }
}
