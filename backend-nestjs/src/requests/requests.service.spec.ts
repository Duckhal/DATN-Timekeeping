import { ForbiddenException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RequestsService } from './requests.service';

type PrismaMock = {
  request: {
    count: jest.Mock;
    findMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

function requestRow(overrides: Record<string, unknown> = {}) {
  return {
    request_id: 1,
    employee_id: 7,
    attendance_id: null,
    type: 'OT',
    status: 'PENDING',
    date: new Date(2026, 5, 17),
    start_time: null,
    end_time: null,
    reason: 'Need overtime',
    created_at: new Date('2026-06-17T09:00:00.000Z'),
    updated_at: new Date('2026-06-17T09:00:00.000Z'),
    employee: {
      full_name: 'Nguyen Van A',
      email: 'employee@example.com',
    },
    ...overrides,
  };
}

describe('RequestsService manager listing', () => {
  let prisma: PrismaMock;
  let service: RequestsService;

  beforeEach(() => {
    prisma = {
      request: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    service = new RequestsService(
      prisma as unknown as PrismaService,
      { create: jest.fn() } as unknown as NotificationsService,
    );
  });

  it('lists all request statuses for Manager when status is omitted', async () => {
    const rows = [
      requestRow(),
      requestRow({ request_id: 2, status: 'APPROVED' }),
      requestRow({ request_id: 3, status: 'REJECTED' }),
    ];
    prisma.request.count.mockReturnValue('count-query');
    prisma.request.findMany.mockReturnValue('find-query');
    prisma.$transaction.mockResolvedValue([3, rows]);

    const result = await service.findForManager('MANAGER', {
      page: 1,
      pageSize: 20,
    });

    expect(prisma.request.count).toHaveBeenCalledWith({ where: {} });
    expect(prisma.request.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { created_at: 'desc' },
        skip: 0,
        take: 20,
      }),
    );
    expect(result.items.map((item) => item.status)).toEqual([
      'PENDING',
      'APPROVED',
      'REJECTED',
    ]);
    expect(result.total).toBe(3);
  });

  it('filters Manager requests by status and employee search text', async () => {
    prisma.request.count.mockReturnValue('count-query');
    prisma.request.findMany.mockReturnValue('find-query');
    prisma.$transaction.mockResolvedValue([
      1,
      [requestRow({ request_id: 2, status: 'APPROVED' })],
    ]);

    await service.findForManager('MANAGER', {
      status: 'APPROVED',
      search: 'employee@example.com',
      page: 2,
      pageSize: 10,
    });

    const expectedWhere = {
      status: 'APPROVED',
      employee: {
        is: {
          OR: [
            { full_name: { contains: 'employee@example.com', mode: 'insensitive' } },
            { email: { contains: 'employee@example.com', mode: 'insensitive' } },
          ],
        },
      },
    };
    expect(prisma.request.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(prisma.request.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
        skip: 10,
        take: 10,
      }),
    );
  });

  it('blocks non-Manager users from manager request listing', async () => {
    await expect(service.findForManager('EMPLOYEE', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.request.count).not.toHaveBeenCalled();
  });
});
