# DATN Timekeeping System

DATN Timekeeping System is an IoT-based attendance management system that combines embedded hardware, a backend API, a relational database, realtime messaging, and a web management portal.

The system is designed to record employee attendance through fingerprint and RFID authentication, synchronize credentials across multiple timekeeping devices, and provide managers with tools to manage employees, devices, attendance records, requests, notifications, and payroll.

## Overview

The project has three main runtime parts:

- **ESP32 firmware** for the physical timekeeping device.
- **NestJS backend server** for authentication, business logic, persistence, device communication, notifications, and payroll processing.
- **React web portal** for Manager and Employee users.

The device communicates with the backend through HTTP for request/response operations and MQTT for realtime commands such as fingerprint enrollment, credential deletion, and multi-device synchronization.

## Architecture

The system follows a layered IoT architecture:

- **Perception layer**: ESP32 device, fingerprint sensor, RFID reader, TFT display, buzzer, and local firmware logic.
- **Network layer**: HTTP, MQTT, Wi-Fi, and WebSocket communication.
- **Processing layer**: NestJS backend, Prisma ORM, PostgreSQL database, attendance calculation, request approval, notification, and payroll logic.
- **Application layer**: React management portal for Manager and Employee workflows.

This separation keeps device operations, backend processing, and user-facing workflows independent while still allowing them to communicate through clear API and messaging contracts.

## Core Features

### Employee Management

Managers can create employee accounts, update employee information, reset passwords, deactivate accounts, and manage authentication credentials.

### Device Management

Managers can register and manage ESP32 timekeeping devices, monitor device status, update device information, and trigger device synchronization workflows.

### Fingerprint and RFID Authentication

The system supports both fingerprint and RFID-based attendance. Fingerprint templates are stored and synchronized using a per-device mapping model so each physical device can keep its own local sensor slot while the backend remains the source of truth.

### Attendance Tracking

Employees can check in and check out through fingerprint or RFID scans. The backend stores raw check-in logs and daily attendance records, then calculates workday results, missing minutes, and attendance status based on the configured rules.

### Request Management

Employees can create overtime and explanation requests. Managers can search, filter, approve, or reject requests. Approved explanation requests update the related attendance record.

### Notifications

The notification system stores all notifications in the database and pushes realtime updates to the frontend through Socket.io. Offline users can still see notifications when they reopen the portal.

### Payroll Publishing

Managers can publish monthly payroll records. The backend calculates salary from attendance data and hourly rate snapshots, generates protected PDF payslips, and sends payroll notifications to employees.

## User Roles

| Role | Main Responsibilities |
| --- | --- |
| Manager | Manage employees, devices, credentials, attendance logs, requests, notifications, and payroll |
| Employee | View personal attendance, create requests, receive notifications, and view payroll records |

## Technology Stack

| Layer | Technologies |
| --- | --- |
| Firmware | ESP32, PlatformIO, Arduino framework |
| Hardware modules | Fingerprint sensor, RC522 RFID reader, TFT SPI display, buzzer |
| Backend | NestJS, TypeScript, Prisma |
| Database | PostgreSQL |
| Realtime messaging | MQTT with EMQX, Socket.io |
| Frontend | React, Vite, TypeScript, MUI |
| Deployment support | Docker Compose, GitHub Actions |

## Repository Structure

```text
DATN/
|-- backend-nestjs/            # NestJS backend and Prisma database schema
|-- frontend-react/web-js/     # React web management portal
|-- firmware/                  # ESP32 firmware source code
|-- plan/                      # Planning notes, workflows, and diagrams
|-- docker-compose.yml         # Local/server service composition
`-- README.md
```

## Key Data Flows

### Attendance Flow

1. Employee scans fingerprint or RFID card on an ESP32 device.
2. Firmware sends the credential data to the backend.
3. Backend resolves the employee, records the check-in/check-out event, and updates the daily attendance record.
4. The web portal displays attendance history and computed attendance results.

### Fingerprint Enrollment Flow

1. Manager starts fingerprint enrollment from the web portal.
2. Backend sends an MQTT command to the selected device.
3. Firmware captures the fingerprint template and sends the result back to the backend.
4. Backend stores the template, updates device mappings, and broadcasts synchronization commands to other devices.

### Request Approval Flow

1. Employee creates an overtime or explanation request.
2. Manager reviews the request from the approval page.
3. Backend updates request status and applies attendance changes when required.
4. Employee receives a notification about the result.

### Payroll Flow

1. Manager publishes payroll for a selected month.
2. Backend calculates standard hours, actual hours, hourly rate snapshots, and salary.
3. Backend generates protected PDF payslips.
4. Employees receive payroll notifications and open their own payslip through the portal.

## Project Focus

The project focuses on building a complete attendance system across hardware, backend, and frontend layers. Important technical concerns include secure device communication, role-based access control, reliable credential synchronization, attendance rule calculation, realtime notification delivery, and protected payroll access.
