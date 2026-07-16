import { Global, Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Global()
@Module({
  imports: [NotificationsModule],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
