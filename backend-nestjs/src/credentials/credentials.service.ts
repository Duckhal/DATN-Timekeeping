import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { DevicesService } from '../devices/devices.service';
import { MqttService } from '../mqtt/mqtt.service';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);
  private static readonly FINGERPRINT_CACHE_TTL_MS = 120_000;

  constructor(
    private readonly devicesService: DevicesService,
    private readonly mqttService: MqttService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly prisma: PrismaService,
  ) {}

  async registerDevice(mac_addr: string, name: string) {
    return this.devicesService.registerHeartbeat(mac_addr, name);
  }

  async startFingerprintEnroll(deviceId: number, employeeId: number) {
    const device = await this.devicesService.findById(deviceId);

    // Set intent to cache so we know WHO is enrolling on THIS device
    const intentKey = `enroll_intent_${device.device_id}`;
    await this.cacheManager.set(intentKey, employeeId, CredentialsService.FINGERPRINT_CACHE_TTL_MS);

    const topic = `timekeeping/device/${device.mac_addr}/command`;
    await this.mqttService.publish(topic, {
      command: 'ENROLL_FINGERPRINT',
    });

    this.logger.log(
      `[Command] MQTT ENROLL_FINGERPRINT published for device ${deviceId} (${device.mac_addr})`,
    );

    return { message: 'Enrollment command published via MQTT' };
  }

  async cacheFingerprint(mac_addr: string, fingerprintId: string, templateData: string) {
    const device = await this.devicesService.findByMac(mac_addr);

    if (!device) {
      throw new NotFoundException(`Device with mac_addr ${mac_addr} not found.`);
    }

    const employeeId = await this.cacheManager.get('enroll_intent_' + device.device_id);

    if (!employeeId) {
      throw new NotFoundException(`No enrollment intent found for device ${device.device_id}.`);
    }

    const empId = Number(employeeId);
    const parsedFingerprintId = parseInt(fingerprintId, 10);

    // 1. Update the master template in Employee table
    await this.prisma.employee.update({
      where: { employee_id: empId },
      data: { template_fingerprint: templateData },
    });

    // 2. Upsert the mapping for this specific device
    await this.prisma.mapping.upsert({
      where: { 
        device_id_employee_id: { 
          device_id: device.device_id, 
          employee_id: empId 
        } 
      },
      update: { fingerprint_id: parsedFingerprintId },
      create: { 
        device_id: device.device_id,
        employee_id: empId,
        fingerprint_id: parsedFingerprintId 
      },
    });

    // 3. Clean up the intent cache
    await this.cacheManager.del('enroll_intent_' + device.device_id);

    // 4. Broadcast the new fingerprint to all remaining devices.
    //    `mac_addr` identifies the source device so it can ignore its own SYNC.
    const syncTopic = 'timekeeping/devices/sync-fingerprint';
    const syncPayload = {
      command: 'SYNC_FINGERPRINT',
      mac_addr,
      employee_id: empId,
      template_data: templateData,
    };
    await this.mqttService.publish(syncTopic, syncPayload);

    this.logger.log(
      `[Enroll] Successfully saved fingerprint for Employee ${empId} on mapping device ${device.device_id}`,
    );
    this.logger.log(`[Sync] Broadcasted new fingerprint for employee ${empId} to '${syncTopic}'`);

    return {
      status: 'success',
      message: 'Fingerprint saved and broadcasted successfully',
    };
  }

  /**
   * Called by non-source devices after they store the synced template in their
   * own sensor. Only upserts the per-device Mapping row — never touches the
   * Employee.template_fingerprint master.
   */
  async upsertSyncMapping(
    mac_addr: string,
    employeeId: number,
    fingerprintId: number,
  ) {
    const device = await this.devicesService.findByMac(mac_addr);

    if (!device) {
      throw new NotFoundException(`Device with mac_addr ${mac_addr} not found.`);
    }

    const employee = await this.prisma.employee.findUnique({
      where: { employee_id: employeeId },
      select: { employee_id: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with id ${employeeId} not found.`);
    }

    await this.prisma.mapping.upsert({
      where: {
        device_id_employee_id: {
          device_id: device.device_id,
          employee_id: employeeId,
        },
      },
      update: { fingerprint_id: fingerprintId },
      create: {
        device_id: device.device_id,
        employee_id: employeeId,
        fingerprint_id: fingerprintId,
      },
    });

    this.logger.log(
      `[Sync] Upserted mapping device=${device.device_id} employee=${employeeId} fp_id=${fingerprintId}`,
    );

    return { status: 'success' };
  }

  async getBulkSyncPage(mac_addr: string, pageSize: number = 5) {
    const device = await this.devicesService.findByMac(mac_addr);

    if (!device) {
      throw new NotFoundException(`Device with mac_addr ${mac_addr} not found.`);
    }

    const unmappedEmployees = await this.prisma.employee.findMany({
      where: {
        template_fingerprint: { not: null },
        NOT: {
          mappings: {
            some: { device_id: device.device_id },
          },
        },
      },
      select: {
        employee_id: true,
        template_fingerprint: true,
      },
      orderBy: { employee_id: 'asc' },
      take: pageSize,
    });

    const total = await this.prisma.employee.count({
      where: {
        template_fingerprint: { not: null },
        NOT: {
          mappings: {
            some: { device_id: device.device_id },
          },
        },
      },
    });

    return {
      items: unmappedEmployees.map((e) => ({
        employee_id: e.employee_id,
        template_data: e.template_fingerprint,
      })),
      has_more: total > pageSize,
      total,
    };
  }

  async ackBulkSync(
    mac_addr: string,
    mappings: { employee_id: number; fingerprint_id: number }[],
  ) {
    const device = await this.devicesService.findByMac(mac_addr);

    if (!device) {
      throw new NotFoundException(`Device with mac_addr ${mac_addr} not found.`);
    }

    const data = mappings.map((m) => ({
      device_id: device.device_id,
      employee_id: m.employee_id,
      fingerprint_id: m.fingerprint_id,
    }));

    const result = await this.prisma.mapping.createMany({
      data,
      skipDuplicates: true,
    });

    this.logger.log(
      `[BulkSync] ACK from device ${device.device_id}: ${result.count} mappings created`,
    );

    return { synced: result.count };
  }
}
