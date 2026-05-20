import { Module } from '@nestjs/common';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { RequestsCronService } from './requests.cron';

@Module({
  controllers: [RequestsController],
  providers: [RequestsService, RequestsCronService],
})
export class RequestsModule {}
