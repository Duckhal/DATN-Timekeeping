import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { DevicesService } from '../devices/devices.service';
import { MqttService } from '../mqtt/mqtt.service';

@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);
  private static readonly FINGERPRINT_CACHE_TTL_MS = 120_000;

  constructor(
    private readonly devicesService: DevicesService,
    private readonly mqttService: MqttService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async registerDevice(mac_addr: string, name: string) {
    return this.devicesService.registerHeartbeat(mac_addr, name);
  }

  async startFingerprintEnroll(deviceId: number) {
    const device = await this.devicesService.findById(deviceId);

    const topic = `timekeeping/device/${device.mac_addr}/command`;
    await this.mqttService.publish(topic, {
      command: 'ENROLL_FINGERPRINT',
    });

    this.logger.log(
      `[Command] MQTT ENROLL_FINGERPRINT published for device ${deviceId} (${device.mac_addr})`,
    );

    return { message: 'Enrollment command published via MQTT' };
  }

  async cacheFingerprint(mac_addr: string, fingerprintId: string) {
    const device = await this.devicesService.findByMac(mac_addr);

    if (!device) {
      throw new NotFoundException(`Device with mac_addr ${mac_addr} not found.`);
    }

    const cacheKey = this.getFingerprintEnrollCacheKey(device.device_id);
    await this.cacheManager.set(
      cacheKey,
      fingerprintId,
      CredentialsService.FINGERPRINT_CACHE_TTL_MS,
    );

    this.logger.log(
      `[Enroll] Cached fingerprint callback key=${cacheKey} value=${fingerprintId} ttlMs=${CredentialsService.FINGERPRINT_CACHE_TTL_MS}`,
    );

    return {
      status: 'success',
      message: 'Fingerprint cached',
    };
  }

  getFingerprintEnrollCacheKey(deviceId: number) {
    return `enroll_finger_${deviceId}`;
  }
}
