import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { CredentialsController } from './credentials.controller';
import { CredentialsService } from './credentials.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

@Module({
  imports: [DevicesModule],
  controllers: [CredentialsController],
  providers: [CredentialsService, ApiKeyGuard],
  exports: [CredentialsService],
})
export class CredentialsModule {}
