import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { businessDateFromInstant } from '../common/vietnam-time';

@Injectable()
export class RequestsCronService {
  private readonly logger = new Logger(RequestsCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 4 * * *')
  async autoRejectExpiredOtRequests() {
    const today = businessDateFromInstant(new Date());

    const result = await this.prisma.request.updateMany({
      where: {
        type: 'OT',
        status: 'PENDING',
        date: { lt: today },
      },
      data: { status: 'REJECTED' },
    });

    if (result.count > 0) {
      this.logger.log(
        `[AutoReject] Rejected ${result.count} expired OT request(s).`,
      );
    }
  }
}
