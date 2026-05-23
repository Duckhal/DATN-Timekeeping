import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

export type CreateNotificationInput = {
  title: string;
  content?: string;
  type: string;
  referenceId?: number;
  metadata?: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async create(employeeId: number, input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        employee_id: employeeId,
        title: input.title,
        content: input.content ?? null,
        type: input.type,
        reference_id: input.referenceId ?? null,
        metadata: input.metadata ?? null,
      },
    });

    const formatted = this.formatNotification(notification);

    this.gateway.sendToUser(employeeId, 'notification:new', formatted);
    this.logger.log(`[Notify] employee=${employeeId} type=${input.type}`);

    return formatted;
  }

  async findByEmployee(employeeId: number, query: QueryNotificationsDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);

    const where = { employee_id: employeeId };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((r) => this.formatNotification(r)),
      page,
      pageSize,
      total,
    };
  }

  async getUnreadCount(employeeId: number) {
    const count = await this.prisma.notification.count({
      where: { employee_id: employeeId, is_read: false },
    });
    return { count };
  }

  async markAsRead(notificationId: number, employeeId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { notification_id: notificationId },
    });
    if (!notification || notification.employee_id !== employeeId) {
      throw new NotFoundException('Notification not found.');
    }

    await this.prisma.notification.update({
      where: { notification_id: notificationId },
      data: { is_read: true },
    });

    return { success: true };
  }

  async markAllAsRead(employeeId: number) {
    await this.prisma.notification.updateMany({
      where: { employee_id: employeeId, is_read: false },
      data: { is_read: true },
    });
    return { success: true };
  }

  private formatNotification(row: any) {
    return {
      notification_id: row.notification_id,
      employee_id: row.employee_id,
      title: row.title,
      content: row.content,
      type: row.type,
      reference_id: row.reference_id,
      metadata: row.metadata,
      is_read: row.is_read,
      created_at: row.created_at?.toISOString?.() ?? row.created_at,
    };
  }
}
