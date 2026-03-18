-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'HR');

-- CreateEnum
CREATE TYPE "CalcStatus" AS ENUM ('PENDING', 'CALCULATED', 'RECALCULATED', 'ERROR');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('OT', 'EXPLANATION', 'LEAVE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Employee" (
    "emp_id" SERIAL NOT NULL,
    "fingerprint_id" TEXT,
    "account_username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "hourly_rate" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("emp_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_fingerprint_id_key" ON "Employee"("fingerprint_id");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_account_username_key" ON "Employee"("account_username");
