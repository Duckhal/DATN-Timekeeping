import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { DevicesService } from './devices.service';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @Roles('HR')
  findAll() {
    return this.devicesService.findAll();
  }

  @Patch(':id')
  @Roles('HR')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDeviceDto,
  ) {
    return this.devicesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('HR')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.devicesService.remove(id);
  }
}
