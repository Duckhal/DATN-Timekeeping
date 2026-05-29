import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from '../mqtt/mqtt.service';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqttService: MqttService,
  ) {}

  private toHeartbeatResponse(device: {
    device_id: number;
    status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | null;
    name: string | null;
  }) {
    return {
      device_id: device.device_id,
      status: device.status ?? 'ACTIVE',
      name: device.name,
    };
  }

  async registerHeartbeat(mac_addr: string, name: string) {
    const existing = await this.prisma.device.findUnique({
      where: { mac_addr },
    });

    if (!existing) {
      const created = await this.prisma.device.create({
        data: {
          mac_addr,
          name,
          status: 'ACTIVE',
        },
      });

      return this.toHeartbeatResponse(created);
    }

    if (existing.status === 'INACTIVE' || existing.status === 'MAINTENANCE') {
      return this.toHeartbeatResponse(existing);
    }

    const updated = await this.prisma.device.update({
      where: { device_id: existing.device_id },
      data: { name },
    });

    return this.toHeartbeatResponse(updated);
  }

  async acknowledgeFactoryReset(mac_addr: string) {
    const existing = await this.prisma.device.findUnique({
      where: { mac_addr },
    });

    if (existing) {
      await this.prisma.device.update({
        where: { device_id: existing.device_id },
        data: { status: 'INACTIVE' },
      });
    }

    return { message: 'Device reset acknowledged' };
  }

  async findAll() {
    return this.prisma.device.findMany({
      orderBy: { device_id: 'asc' },
    });
  }

  async findByMac(mac_addr: string) {
    const device = await this.prisma.device.findUnique({ where: { mac_addr } });

    if (!device) {
      throw new NotFoundException(`Device with mac_addr ${mac_addr} not found.`);
    }

    return device;
  }

  async findById(deviceId: number) {
    const device = await this.prisma.device.findUnique({
      where: { device_id: deviceId },
    });

    if (!device) {
      throw new NotFoundException(`Device with id ${deviceId} not found.`);
    }

    return device;
  }

  async update(deviceId: number, dto: UpdateDeviceDto) {
    if (!dto.name && !dto.status) {
      throw new BadRequestException('At least one field (name or status) is required.');
    }

    const device = await this.findById(deviceId);

    const updated = await this.prisma.device.update({
      where: { device_id: deviceId },
      data: {
        name: dto.name,
        status: dto.status,
      },
    });

    if (dto.status) {
      this.publishStatusUpdate(device.mac_addr, dto.status);
    }

    return updated;
  }

  async remove(deviceId: number) {
    const device = await this.findById(deviceId);

    const checkInLogCount = await this.prisma.checkInLog.count({
      where: { device_id: deviceId },
    });

    if (checkInLogCount > 0) {
      const softDeleted = await this.prisma.device.update({
        where: { device_id: deviceId },
        data: { status: 'INACTIVE' },
      });

      this.publishStatusUpdate(device.mac_addr, 'INACTIVE');

      return {
        mode: 'SOFT_DELETE',
        message: 'Device has historical check-ins. Status changed to INACTIVE.',
        device: softDeleted,
      };
    }

    const hardDeleted = await this.prisma.device.delete({
      where: { device_id: deviceId },
    });

    return {
      mode: 'HARD_DELETE',
      message: 'Device deleted permanently.',
      device: hardDeleted,
    };
  }

  private publishStatusUpdate(macAddr: string, status: string) {
    const topic = `timekeeping/device/${macAddr}/command`;
    this.mqttService
      .publish(topic, { command: 'STATUS_UPDATE', status })
      .catch((err) => {
        this.logger.warn(
          `MQTT publish failed for device ${macAddr}: ${err.message}`,
        );
      });
  }

  async triggerBulkSync(deviceId: number) {
    const device = await this.findById(deviceId);

    if (device.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Bulk sync can only be triggered for ACTIVE devices.',
      );
    }

    const topic = `timekeeping/device/${device.mac_addr}/command`;
    await this.mqttService.publish(topic, { command: 'START_BULK_SYNC' });

    this.logger.log(
      `[BulkSync] START_BULK_SYNC published to device ${deviceId} (${device.mac_addr})`,
    );

    return { message: 'Bulk sync command sent' };
  }
}
