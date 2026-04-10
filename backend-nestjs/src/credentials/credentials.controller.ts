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
import { StartFingerprintEnrollDto } from './dto/start-fingerprint-enroll.dto';
import { FingerprintCallbackDto } from './dto/fingerprint-callback.dto';

@Controller('devices')
export class CredentialsController {
  constructor(private readonly credentialsService: CredentialsService) {}

  @Public()
  @UseGuards(ApiKeyGuard)
  @Post('register')
  registerDevice(@Body() dto: RegisterDeviceDto) {
    return this.credentialsService.registerDevice(dto.mac_addr, dto.name);
  }

  @Post(':id/enroll-fingerprint')
  @Roles('HR')
  startFingerprintEnroll(
    @Param('id', ParseIntPipe) id: number,
    @Body() _dto: StartFingerprintEnrollDto,
  ) {
    return this.credentialsService.startFingerprintEnroll(id);
  }

  @Public()
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @Post('fingerprint-callback')
  callbackFingerprint(@Body() dto: FingerprintCallbackDto) {
    return this.credentialsService.cacheFingerprint(dto.mac_addr, dto.fingerprint_id);
  }
}
