import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertByMac(mac_addr: string, name: string) {
    return this.prisma.device.upsert({
      where: { mac_addr },
      update: { name, status: 'ACTIVE' },
      create: { mac_addr, name, status: 'ACTIVE' },
    });
  }

  async findAllActive() {
    return this.prisma.device.findMany({
      where: { status: 'ACTIVE' },
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

    await this.findById(deviceId);

    return this.prisma.device.update({
      where: { device_id: deviceId },
      data: {
        name: dto.name,
        status: dto.status,
      },
    });
  }

  async remove(deviceId: number) {
    await this.findById(deviceId);

    const checkInLogCount = await this.prisma.checkInLog.count({
      where: { device_id: deviceId },
    });

    if (checkInLogCount > 0) {
      const softDeleted = await this.prisma.device.update({
        where: { device_id: deviceId },
        data: { status: 'INACTIVE' },
      });

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
}
