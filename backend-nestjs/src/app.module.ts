import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { EmployeesModule } from './employees/employees.module';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { CredentialsModule } from './credentials/credentials.module';
import { MqttModule } from './mqtt/mqtt.module';
import { CheckinModule } from './checkin/checkin.module';
import { AttendanceModule } from './attendance/attendance.module';
import { RequestsModule } from './requests/requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    EmployeesModule,
    AuthModule,
    DevicesModule,
    CredentialsModule,
    MqttModule,
    CheckinModule,
    AttendanceModule,
    RequestsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}



