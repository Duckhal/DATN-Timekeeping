import { ForbiddenException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculatePayrollAmounts,
  countWeekdaysInMonth,
  PayrollService,
} from './payroll.service';

type PrismaMock = {
  employee: {
    findMany: jest.Mock;
  };
  dailyAttendance: {
    findMany: jest.Mock;
  };
  request: {
    findMany: jest.Mock;
  };
  payrollRecord: {
    upsert: jest.Mock;
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
};

function timeAt(hour: number, minute = 0): Date {
  const value = new Date(1970, 0, 1, hour, minute, 0);
  return value;
}

function payrollRecord(overrides: Record<string, unknown> = {}) {
  return {
    payroll_id: 10,
    employee_id: 7,
    month_year: '2026-06',
    standard_hours: '176.00',
    actual_hours: '8.00',
    hourly_rate: '25000.00',
    salary_amount: '200000.00',
    pdf_path: 'storage/payroll/2026-06/employee-7.pdf',
    published_at: new Date('2026-06-30T00:00:00.000Z'),
    created_at: new Date('2026-06-30T00:00:00.000Z'),
    updated_at: new Date('2026-06-30T00:00:00.000Z'),
    employee: {
      employee_id: 7,
      email: 'employee@example.com',
      full_name: 'Employee One',
    },
    ...overrides,
  };
}

describe('Payroll helpers', () => {
  it('counts standard weekday hours for a month', () => {
    expect(countWeekdaysInMonth('2026-06') * 8).toBe(176);
  });

  it('calculates actual hours and salary from workday credit', () => {
    expect(
      calculatePayrollAmounts({
        standardHours: 176,
        totalWorkday: 1.25,
        hourlyRate: 25000,
      }),
    ).toEqual({
      standardHours: 176,
      actualHours: 10,
      hourlyRate: 25000,
      salaryAmount: 250000,
    });
  });
});

describe('PayrollService', () => {
  let prisma: PrismaMock;
  let notifications: { create: jest.Mock };
  let service: PayrollService;

  beforeEach(() => {
    prisma = {
      employee: { findMany: jest.fn() },
      dailyAttendance: { findMany: jest.fn() },
      request: { findMany: jest.fn() },
      payrollRecord: { upsert: jest.fn(), findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    notifications = { create: jest.fn() };
    service = new PayrollService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
    jest
      .spyOn(service as unknown as { writePayrollPdf: () => Promise<void> }, 'writePayrollPdf')
      .mockResolvedValue(undefined);
  });

  it('publishes payroll records, regenerates PDF, and sends notifications', async () => {
    prisma.employee.findMany.mockResolvedValue([
      {
        employee_id: 7,
        email: 'employee@example.com',
        full_name: 'Employee One',
        hourly_rate: '25000.00',
      },
    ]);
    prisma.$transaction.mockResolvedValue([
      [
        {
          employee_id: 7,
          date: new Date(2026, 5, 1),
          checkin_time: timeAt(8),
          checkout_time: timeAt(17, 30),
        },
        {
          employee_id: 7,
          date: new Date(2026, 5, 6),
          checkin_time: timeAt(9),
          checkout_time: timeAt(21),
        },
        {
          employee_id: 7,
          date: new Date(2026, 5, 2),
          checkin_time: timeAt(8),
          checkout_time: null,
        },
      ],
      [{ employee_id: 7, date: new Date(2026, 5, 6) }],
    ]);
    prisma.payrollRecord.upsert.mockResolvedValue(
      payrollRecord({
        actual_hours: '20.00',
        salary_amount: '500000.00',
      }),
    );
    notifications.create.mockResolvedValue({});

    const result = await service.publishMonthlyPayroll('2026-06');

    expect(prisma.payrollRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          employee_id_month_year: {
            employee_id: 7,
            month_year: '2026-06',
          },
        },
        update: expect.objectContaining({
          standard_hours: 176,
          hourly_rate: 25000,
          pdf_path: 'storage/payroll/2026-06/employee-7.pdf',
        }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        type: 'PAYROLL',
        referenceId: 10,
        metadata: JSON.stringify({ payroll_id: 10, month: '2026-06' }),
      }),
    );
    expect(result.published_count).toBe(1);
  });

  it('allows the owning employee to read their payroll', async () => {
    prisma.payrollRecord.findUnique.mockResolvedValue(payrollRecord());

    const result = await service.findPayrollForActor(10, {
      employee_id: 7,
      role: 'EMPLOYEE',
    });

    expect(result.payroll_id).toBe(10);
  });

  it('blocks employees from reading another employee payroll PDF', async () => {
    prisma.payrollRecord.findUnique.mockResolvedValue(payrollRecord());

    await expect(
      service.getPayrollPdfFile(10, {
        employee_id: 8,
        role: 'EMPLOYEE',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
