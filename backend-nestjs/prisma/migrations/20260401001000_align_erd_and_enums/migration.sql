-- CreateEnum
CREATE TYPE "AuthMethod" AS ENUM ('RFID', 'FINGERPRINT');

-- Recreate enum (safe here because no existing table references CalcStatus yet)
DROP TYPE "CalcStatus";
CREATE TYPE "CalcStatus" AS ENUM ('SHORTHOURS', 'DAYOFF', 'COMPLETED');

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "created_at",
ADD COLUMN     "DoB" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "rfid_tag" TEXT;

-- CreateTable
CREATE TABLE "Device" (
    "device_id" SERIAL NOT NULL,
    "mac_addr" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("device_id")
);

-- CreateTable
CREATE TABLE "CheckInLog" (
    "log_id" BIGSERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "device_id" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "auth_method" "AuthMethod" NOT NULL,
    "sync_hash" VARCHAR(255) NOT NULL,

    CONSTRAINT "CheckInLog_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "DailyAttendance" (
    "attendance_id" BIGSERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "checkin_time" TIME(0),
    "checkout_time" TIME(0),
    "missing_minutes" INTEGER NOT NULL DEFAULT 0,
    "total_workday" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "status" "CalcStatus" NOT NULL DEFAULT 'COMPLETED',

    CONSTRAINT "DailyAttendance_pkey" PRIMARY KEY ("attendance_id")
);

-- CreateTable
CREATE TABLE "MonthlyLimit" (
    "limit_id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "month_year" VARCHAR(7) NOT NULL,
    "explanation_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MonthlyLimit_pkey" PRIMARY KEY ("limit_id")
);

-- CreateTable
CREATE TABLE "Request" (
    "request_id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "attendance_id" BIGINT,
    "type" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "date" DATE NOT NULL,
    "start_time" TIME(0),
    "end_time" TIME(0),

    CONSTRAINT "Request_pkey" PRIMARY KEY ("request_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_mac_addr_key" ON "Device"("mac_addr");

-- CreateIndex
CREATE UNIQUE INDEX "CheckInLog_sync_hash_key" ON "CheckInLog"("sync_hash");

-- CreateIndex
CREATE INDEX "CheckInLog_employee_id_timestamp_idx" ON "CheckInLog"("employee_id", "timestamp");

-- CreateIndex
CREATE INDEX "CheckInLog_device_id_timestamp_idx" ON "CheckInLog"("device_id", "timestamp");

-- CreateIndex
CREATE INDEX "DailyAttendance_employee_id_idx" ON "DailyAttendance"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAttendance_employee_id_date_key" ON "DailyAttendance"("employee_id", "date");

-- CreateIndex
CREATE INDEX "MonthlyLimit_employee_id_idx" ON "MonthlyLimit"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyLimit_employee_id_month_year_key" ON "MonthlyLimit"("employee_id", "month_year");

-- CreateIndex
CREATE INDEX "Request_employee_id_idx" ON "Request"("employee_id");

-- CreateIndex
CREATE INDEX "Request_attendance_id_idx" ON "Request"("attendance_id");

-- CreateIndex
CREATE INDEX "Request_date_idx" ON "Request"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_rfid_tag_key" ON "Employee"("rfid_tag");

-- AddForeignKey
ALTER TABLE "CheckInLog" ADD CONSTRAINT "CheckInLog_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("emp_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInLog" ADD CONSTRAINT "CheckInLog_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "Device"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAttendance" ADD CONSTRAINT "DailyAttendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("emp_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyLimit" ADD CONSTRAINT "MonthlyLimit_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("emp_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("emp_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "DailyAttendance"("attendance_id") ON DELETE SET NULL ON UPDATE CASCADE;

