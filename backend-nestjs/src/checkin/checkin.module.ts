import { Module } from '@nestjs/common';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

@Module({
  controllers: [CheckinController],
  providers: [CheckinService, ApiKeyGuard],
})
export class CheckinModule {}
