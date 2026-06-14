import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { access, mkdir } from 'fs/promises';
import * as path from 'path';
import pdfMake from 'pdfmake';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { computeAttendance } from '../attendance/attendance.compute';
import type {
  PayrollActor,
  PayrollAmounts,
  PayrollAttendanceRow,
  PayrollEmployee,
  PayrollRecordWithEmployee,
} from '../types';

const PDF_FONT_ROOT = path.resolve(
  process.cwd(),
  'node_modules',
  'pdfmake',
  'fonts',
  'Roboto',
);

pdfMake.setFonts({
  Roboto: {
    normal: path.join(PDF_FONT_ROOT, 'Roboto-Regular.ttf'),
    bold: path.join(PDF_FONT_ROOT, 'Roboto-Medium.ttf'),
    italics: path.join(PDF_FONT_ROOT, 'Roboto-Italic.ttf'),
    bolditalics: path.join(PDF_FONT_ROOT, 'Roboto-MediumItalic.ttf'),
  },
});
pdfMake.setLocalAccessPolicy((filePath) =>
  path.resolve(filePath).startsWith(PDF_FONT_ROOT),
);
pdfMake.setUrlAccessPolicy(() => false);

export function countWeekdaysInMonth(month: string): number {
  const { from, to } = resolveMonthRange(month);
  let count = 0;
  for (
    const date = new Date(from);
    date <= to;
    date.setDate(date.getDate() + 1)
  ) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

export function calculatePayrollAmounts(input: {
  standardHours: number;
  totalWorkday: number;
  hourlyRate: number;
}): PayrollAmounts {
  const actualHours = roundMoney(input.totalWorkday * 8);
  const hourlyRate = roundMoney(input.hourlyRate);
  return {
    standardHours: roundMoney(input.standardHours),
    actualHours,
    hourlyRate,
    salaryAmount: roundMoney(actualHours * hourlyRate),
  };
}

function resolveMonthRange(month: string): { from: Date; to: Date } {
  const [year, monthNumber] = month.split('-').map(Number);
  const from = new Date(year, monthNumber - 1, 1);
  const to = new Date(year, monthNumber, 0);
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  return { from, to };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function decimalToNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);
  private readonly storageRoot = path.resolve(
    process.cwd(),
    'storage',
    'payroll',
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async publishMonthlyPayroll(month: string) {
    const { from, to } = resolveMonthRange(month);
    const standardHours = countWeekdaysInMonth(month) * 8;

    const employees = await this.prisma.employee.findMany({
      where: { role: 'EMPLOYEE', is_active: true },
      select: {
        employee_id: true,
        email: true,
        full_name: true,
        hourly_rate: true,
      },
      orderBy: { employee_id: 'asc' },
    });

    if (employees.length === 0) {
      throw new BadRequestException('No active employees found for payroll.');
    }

    const employeeIds = employees.map((employee) => employee.employee_id);
    const [attendanceRows, otRequests] = await this.prisma.$transaction([
      this.prisma.dailyAttendance.findMany({
        where: {
          employee_id: { in: employeeIds },
          date: { gte: from, lte: to },
        },
        select: {
          employee_id: true,
          date: true,
          checkin_time: true,
          checkout_time: true,
        },
        orderBy: [{ employee_id: 'asc' }, { date: 'asc' }],
      }),
      this.prisma.request.findMany({
        where: {
          employee_id: { in: employeeIds },
          type: 'OT',
          status: 'APPROVED',
          date: { gte: from, lte: to },
        },
        select: { employee_id: true, date: true },
      }),
    ]);

    const rowsByEmployee = new Map<number, PayrollAttendanceRow[]>();
    for (const row of attendanceRows) {
      const rows = rowsByEmployee.get(row.employee_id) ?? [];
      rows.push(row);
      rowsByEmployee.set(row.employee_id, rows);
    }

    const otSet = new Set(
      otRequests.map(
        (request) =>
          `${request.employee_id}_${request.date.toISOString().slice(0, 10)}`,
      ),
    );

    const records = [];
    for (const employee of employees) {
      const rows = rowsByEmployee.get(employee.employee_id) ?? [];
      const totalWorkday = this.calculateTotalWorkday(rows, otSet);
      const amounts = calculatePayrollAmounts({
        standardHours,
        totalWorkday,
        hourlyRate: decimalToNumber(employee.hourly_rate),
      });
      const pdfPath = this.resolveRelativePdfPath(month, employee.employee_id);
      const absolutePath = this.resolveAbsolutePdfPath(pdfPath);

      await this.writePayrollPdf(absolutePath, {
        employee,
        month,
        from: formatDate(from),
        to: formatDate(to),
        ...amounts,
      });

      const record = await this.prisma.payrollRecord.upsert({
        where: {
          employee_id_month_year: {
            employee_id: employee.employee_id,
            month_year: month,
          },
        },
        update: {
          standard_hours: amounts.standardHours,
          actual_hours: amounts.actualHours,
          hourly_rate: amounts.hourlyRate,
          salary_amount: amounts.salaryAmount,
          pdf_path: pdfPath,
          published_at: new Date(),
        },
        create: {
          employee_id: employee.employee_id,
          month_year: month,
          standard_hours: amounts.standardHours,
          actual_hours: amounts.actualHours,
          hourly_rate: amounts.hourlyRate,
          salary_amount: amounts.salaryAmount,
          pdf_path: pdfPath,
        },
        include: { employee: this.employeeInclude() },
      });

      await this.notificationsService.create(employee.employee_id, {
        type: 'PAYROLL',
        title: `Monthly Salary Payslip`,
        content: `Payslip for ${month} has been published. Click to view your payslip.`,
        referenceId: record.payroll_id,
        metadata: JSON.stringify({ payroll_id: record.payroll_id, month }),
      });

      records.push(this.formatPayrollRecord(record));
    }

    this.logger.log(
      `[PayrollPublish] month=${month} published=${records.length}`,
    );

    return {
      month,
      published_count: records.length,
      records,
    };
  }

  async findPayrollForActor(payrollId: number, actor: PayrollActor) {
    const record = await this.prisma.payrollRecord.findUnique({
      where: { payroll_id: payrollId },
      include: { employee: this.employeeInclude() },
    });

    if (!record) {
      throw new NotFoundException('Payroll record not found.');
    }

    this.assertCanRead(record, actor);
    return this.formatPayrollRecord(record);
  }

  async getPayrollPdfFile(payrollId: number, actor: PayrollActor) {
    const record = await this.prisma.payrollRecord.findUnique({
      where: { payroll_id: payrollId },
      include: { employee: this.employeeInclude() },
    });

    if (!record) {
      throw new NotFoundException('Payroll record not found.');
    }

    this.assertCanRead(record, actor);
    const absolutePath = this.resolveAbsolutePdfPath(record.pdf_path);

    try {
      await access(absolutePath);
    } catch {
      throw new NotFoundException('Payroll PDF file not found.');
    }

    return {
      filename: `payroll-${record.month_year}-employee-${record.employee_id}.pdf`,
      stream: createReadStream(absolutePath),
    };
  }

  private calculateTotalWorkday(
    rows: PayrollAttendanceRow[],
    otSet: Set<string>,
  ): number {
    return rows.reduce((sum, row) => {
      const dateKey = row.date.toISOString().slice(0, 10);
      const dayOfWeek = row.date.getDay();
      const computed = computeAttendance({
        checkin: row.checkin_time,
        checkout: row.checkout_time,
        otApproved: otSet.has(`${row.employee_id}_${dateKey}`),
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      });
      return sum + parseFloat(computed.totalWorkday);
    }, 0);
  }

  private async writePayrollPdf(
    absolutePath: string,
    input: {
      employee: PayrollEmployee;
      month: string;
      from: string;
      to: string;
      standardHours: number;
      actualHours: number;
      hourlyRate: number;
      salaryAmount: number;
    },
  ) {
    await mkdir(path.dirname(absolutePath), { recursive: true });

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [48, 48, 48, 48],
      defaultStyle: { font: 'Roboto', fontSize: 11 },
      styles: {
        title: { fontSize: 20, bold: true, alignment: 'center' },
        subtitle: { fontSize: 12, alignment: 'center', color: '#475569' },
        label: { bold: true, color: '#334155' },
        total: { bold: true, fontSize: 13 },
      },
      content: [
        { text: 'PHIẾU LƯƠNG THÁNG', style: 'title' },
        { text: `Tháng ${input.month}`, style: 'subtitle', margin: [0, 4, 0, 24] },
        {
          table: {
            widths: ['35%', '*'],
            body: [
              [{ text: 'Nhân viên', style: 'label' }, input.employee.full_name],
              [{ text: 'Email', style: 'label' }, input.employee.email],
              [{ text: 'Kỳ lương', style: 'label' }, `${input.from} đến ${input.to}`],
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 20],
        },
        {
          table: {
            widths: ['*', '30%'],
            body: [
              [
                { text: 'Chỉ tiêu', bold: true, fillColor: '#E2E8F0' },
                { text: 'Giá trị', bold: true, fillColor: '#E2E8F0', alignment: 'right' },
              ],
              ['Tổng số giờ tiêu chuẩn', { text: input.standardHours.toFixed(2), alignment: 'right' }],
              ['Tổng số giờ thực tế', { text: input.actualHours.toFixed(2), alignment: 'right' }],
              ['Mức lương theo giờ', { text: formatVnd(input.hourlyRate), alignment: 'right' }],
              [
                { text: 'Lương tháng', style: 'total' },
                { text: formatVnd(input.salaryAmount), style: 'total', alignment: 'right' },
              ],
            ],
          },
          layout: 'lightHorizontalLines',
        },
        {
          text: 'Phiếu lương được tạo tự động từ hệ thống chấm công.',
          color: '#64748B',
          fontSize: 10,
          margin: [0, 28, 0, 0],
        },
      ],
      info: {
        title: `Payroll ${input.month} - ${input.employee.full_name}`,
        author: 'Timekeeping System',
        subject: 'Monthly payroll',
      },
    };

    await pdfMake.createPdf(docDefinition).write(absolutePath);
  }

  private assertCanRead(record: { employee_id: number }, actor: PayrollActor) {
    if (actor.role === 'MANAGER') return;
    if (record.employee_id === actor.employee_id) return;
    throw new ForbiddenException('You cannot access this payroll record.');
  }

  private resolveRelativePdfPath(month: string, employeeId: number): string {
    return path.posix.join(
      'storage',
      'payroll',
      month,
      `employee-${employeeId}.pdf`,
    );
  }

  private resolveAbsolutePdfPath(relativePath: string): string {
    const absolutePath = path.resolve(process.cwd(), relativePath);
    const storageRoot = path.resolve(process.cwd(), 'storage', 'payroll');
    const relativeFromStorage = path.relative(storageRoot, absolutePath);
    if (
      relativeFromStorage.startsWith('..') ||
      path.isAbsolute(relativeFromStorage)
    ) {
      throw new ForbiddenException('Invalid payroll file path.');
    }
    return absolutePath;
  }

  private employeeInclude() {
    return {
      select: {
        employee_id: true,
        email: true,
        full_name: true,
      },
    };
  }

  private formatPayrollRecord(record: PayrollRecordWithEmployee) {
    return {
      payroll_id: record.payroll_id,
      employee_id: record.employee_id,
      month_year: record.month_year,
      standard_hours: String(record.standard_hours),
      actual_hours: String(record.actual_hours),
      hourly_rate: String(record.hourly_rate),
      salary_amount: String(record.salary_amount),
      pdf_url: `/api/payroll/${record.payroll_id}/pdf`,
      published_at: record.published_at.toISOString(),
      created_at: record.created_at.toISOString(),
      updated_at: record.updated_at.toISOString(),
      employee: record.employee,
    };
  }
}
