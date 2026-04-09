-- CreateEnum
CREATE TYPE "Role" AS ENUM ('HR', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "CalcStatus" AS ENUM ('SHORTHOURS', 'DAYOFF', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('OT', 'EXPLANATION', 'LEAVE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuthMethod" AS ENUM ('RFID', 'FINGERPRINT');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- CreateTable
CREATE TABLE "employees" (
    "employee_id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "date_of_birth" DATE,
    "hourly_rate" DECIMAL(10,2) NOT NULL,
    "rfid_tag" TEXT,
    "fingerprint_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("employee_id")
);

-- CreateTable
CREATE TABLE "devices" (
    "device_id" SERIAL NOT NULL,
    "mac_addr" TEXT NOT NULL,
    "name" TEXT,
    "status" "DeviceStatus" DEFAULT 'ACTIVE',

    CONSTRAINT "devices_pkey" PRIMARY KEY ("device_id")
);

-- CreateTable
CREATE TABLE "checkinlogs" (
    "log_id" BIGSERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "device_id" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "auth_method" "AuthMethod" NOT NULL,
    "sync_hash" VARCHAR(255) NOT NULL,

    CONSTRAINT "checkinlogs_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "dailyattendance" (
    "attendance_id" BIGSERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "checkin_time" TIME(0),
    "checkout_time" TIME(0),
    "missing_minutes" INTEGER NOT NULL DEFAULT 0,
    "total_workday" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "status" "CalcStatus" NOT NULL DEFAULT 'COMPLETED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dailyattendance_pkey" PRIMARY KEY ("attendance_id")
);

-- CreateTable
CREATE TABLE "monthlylimits" (
    "limit_id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "month_year" VARCHAR(7) NOT NULL,
    "explanation_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "monthlylimits_pkey" PRIMARY KEY ("limit_id")
);

-- CreateTable
CREATE TABLE "requests" (
    "request_id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "attendance_id" BIGINT,
    "type" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "date" DATE NOT NULL,
    "start_time" TIME(0),
    "end_time" TIME(0),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("request_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_rfid_tag_key" ON "employees"("rfid_tag");

-- CreateIndex
CREATE UNIQUE INDEX "employees_fingerprint_id_key" ON "employees"("fingerprint_id");

-- CreateIndex
CREATE UNIQUE INDEX "devices_mac_addr_key" ON "devices"("mac_addr");

-- CreateIndex
CREATE UNIQUE INDEX "checkinlogs_sync_hash_key" ON "checkinlogs"("sync_hash");

-- CreateIndex
CREATE INDEX "checkinlogs_employee_id_timestamp_idx" ON "checkinlogs"("employee_id", "timestamp");

-- CreateIndex
CREATE INDEX "checkinlogs_device_id_timestamp_idx" ON "checkinlogs"("device_id", "timestamp");

-- CreateIndex
CREATE INDEX "dailyattendance_employee_id_idx" ON "dailyattendance"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "dailyattendance_employee_id_date_key" ON "dailyattendance"("employee_id", "date");

-- CreateIndex
CREATE INDEX "monthlylimits_employee_id_idx" ON "monthlylimits"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "monthlylimits_employee_id_month_year_key" ON "monthlylimits"("employee_id", "month_year");

-- CreateIndex
CREATE INDEX "requests_employee_id_idx" ON "requests"("employee_id");

-- CreateIndex
CREATE INDEX "requests_attendance_id_idx" ON "requests"("attendance_id");

-- CreateIndex
CREATE INDEX "requests_date_idx" ON "requests"("date");

-- AddForeignKey
ALTER TABLE "checkinlogs" ADD CONSTRAINT "checkinlogs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkinlogs" ADD CONSTRAINT "checkinlogs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dailyattendance" ADD CONSTRAINT "dailyattendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthlylimits" ADD CONSTRAINT "monthlylimits_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "dailyattendance"("attendance_id") ON DELETE SET NULL ON UPDATE CASCADE;
