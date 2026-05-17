import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// BigInt is not JSON-serializable by default — convert to string globally so
// Prisma BigInt columns (e.g. DailyAttendance.attendance_id) survive res.json().
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Enable global input validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // Strip properties not in the DTO
      forbidNonWhitelisted: true, // Throw error if unknown properties are sent
      transform: true,            // Auto-transform payloads to DTO instances
    }),
  );

  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();

