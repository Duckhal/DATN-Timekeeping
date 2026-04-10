import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { DevicesService } from '../devices/devices.service';

@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);

  constructor(
    private readonly devicesService: DevicesService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async registerDevice(mac_addr: string, name: string) {
    return this.devicesService.upsertByMac(mac_addr, name);
  }

  async startFingerprintEnroll(deviceId: number) {
    await this.devicesService.findById(deviceId);

    this.logger.log(
      `[Command] Sending FINGERPRINT_ENROLL_START to device ${deviceId}`,
    );

    return { message: 'Command sent to device' };
  }

  async cacheFingerprint(mac_addr: string, fingerprintId: string) {
    const device = await this.devicesService.findByMac(mac_addr);

    if (!device) {
      throw new NotFoundException(`Device with mac_addr ${mac_addr} not found.`);
    }

    const cacheKey = this.getFingerprintEnrollCacheKey(device.device_id);
    await this.cacheManager.set(cacheKey, fingerprintId, 120);

    return {
      status: 'success',
      message: 'Fingerprint cached',
    };
  }

  getFingerprintEnrollCacheKey(deviceId: number) {
    return `enroll_finger_${deviceId}`;
  }
}
