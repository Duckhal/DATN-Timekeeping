import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { CredentialsService } from './credentials.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { FingerprintCallbackDto } from './dto/fingerprint-callback.dto';
import { SyncMappingCallbackDto } from './dto/sync-mapping-callback.dto';

@Controller('devices')
export class CredentialsController {
  constructor(private readonly credentialsService: CredentialsService) {}

  @Public()
  @UseGuards(ApiKeyGuard)
  @Post('register')
  registerDevice(@Body() dto: RegisterDeviceDto) {
    return this.credentialsService.registerDevice(dto.mac_addr, dto.name);
  }

  @Post(':id/enroll-fingerprint/:employeeId')
  @Roles('HR')
  startFingerprintEnroll(
    @Param('id', ParseIntPipe) id: number,
    @Param('employeeId', ParseIntPipe) employeeId: number,
  ) {
    return this.credentialsService.startFingerprintEnroll(id, employeeId);
  }

  @Public()
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @Post('fingerprint-callback')
  callbackFingerprint(@Body() dto: FingerprintCallbackDto) {
    return this.credentialsService.cacheFingerprint(dto.mac_addr, dto.fingerprint_id, dto.template_data);
  }

  @Public()
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @Post('sync-mapping-callback')
  syncMappingCallback(@Body() dto: SyncMappingCallbackDto) {
    return this.credentialsService.upsertSyncMapping(
      dto.mac_addr,
      dto.employee_id,
      dto.fingerprint_id,
    );
  }
}
