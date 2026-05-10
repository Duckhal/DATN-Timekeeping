import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { EmployeesModule } from './employees/employees.module';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { CredentialsModule } from './credentials/credentials.module';
import { MqttModule } from './mqtt/mqtt.module';
import { CheckinModule } from './checkin/checkin.module';

@Module({
  imports: [
    // Load .env globally — all modules can inject ConfigService without re-importing
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({ isGlobal: true }),
    PrismaModule,
    EmployeesModule,
    AuthModule,
    DevicesModule,
    CredentialsModule,
    MqttModule,
    CheckinModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}



