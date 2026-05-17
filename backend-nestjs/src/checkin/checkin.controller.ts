import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { CheckinService } from './checkin.service';
import { CheckinDto } from './dto/checkin.dto';

@Controller('devices')
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @Public()
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @Post('checkin')
  checkin(@Body() dto: CheckinDto) {
    return this.checkinService.handle(dto);
  }
}
