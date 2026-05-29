import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { DevicesService } from './devices.service';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { FactoryResetDto } from './dto/factory-reset.dto';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Public()
  @UseGuards(ApiKeyGuard)
  @Post('factory-reset')
  acknowledgeFactoryReset(@Body() dto: FactoryResetDto) {
    return this.devicesService.acknowledgeFactoryReset(dto.mac_addr);
  }

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

  @Post(':id/bulk-sync')
  @Roles('HR')
  triggerBulkSync(@Param('id', ParseIntPipe) id: number) {
    return this.devicesService.triggerBulkSync(id);
  }
}
