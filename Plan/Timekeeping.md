# 📄 Timekeeping System Plan: Master Blueprint (v3.1 - Payroll Grade)

## 1. Project Overview
A highly accurate, fingerprint-based timekeeping system designed for payroll integration. It automatically calculates workdays using overlap-time logic, cleanly separates Standard vs. Overtime (OT) boundaries, and maintains strict idempotency and audit trails for manual corrections.

---

## 2. Business Rules & Operational Boundaries

### 2.1. Time Blocks & Strict Boundaries
To prevent overlap and double-counting, time is strictly partitioned:
* **Core Working Block:** 08:00 - 17:30 (Max 8 working hours).
* **Grace Period:** 17:30 - 18:30 (Checkout allowed without penalty; adds no extra standard credit if 8 hours are already met).
* **Absolute OT Block:** 18:30 - 24:00 (Requires an approved OT request).
* **Lunch Break (Overlap based):** 12:00 - 13:30.
* **Dinner Break (Overlap based):** 18:30 - 20:00 (1.5 hours deducted if working OT).

### 2.2. Check-in/Check-out & Sync Logic
* **Timezone & Drift:** All timestamps must be synced and stored in UTC/Server Timezone.
* **Midnight Crossing (Late Checkout):** If a scan occurs between 00:00 and 04:00 AM without a previous check-out, it is assigned to the previous calendar day.
* **Missing Scans:** No checkout = 0 credit. Requires an approved `Explanation Request` to trigger recalculation.

### 2.3. Leaves, Holidays & Weekends
* Standard daily credit defaults to 0 on weekends and official holidays unless a specific shift is assigned.
* Approved Leaves (Paid Time Off) insert a virtual log mapping to 8 hours of standard credit, bypassing raw log calculation.

### 2.4. Manual Correction (Explanations)
* Applied when an employee forgets to Check-in or Check-out.
* **Limit:** Maximum 2 times/month/employee.

### 2.5. Authentication & Fingerprint Onboarding
* **Account Provisioning:** HR creates an employee profile in the Core System (`POST /api/employees`), generating `employee_id`. The account is unusable for time-tracking until at least one credential (RFID or fingerprint) is bound.
* **Credential Binding:**
  * **RFID:** HR assigns a tag via `PATCH /api/employees/:id/credentials/rfid`. The unique `rfid_tag` is stored on `Employee.rfid_tag` (unique constraint enforces one tag per employee).
  * **Fingerprint:** HR triggers `POST /api/devices/:id/enroll-fingerprint/:employeeId`. The backend caches the enrollment intent and publishes an MQTT command to the source device. After the employee registers two prints on the device, firmware POSTs `/api/devices/fingerprint-callback` with the template hex; backend writes `Employee.template_fingerprint` (master) and upserts `Mapping(device_id, employee_id, fingerprint_id)` (per-device slot). Backend then broadcasts `SYNC_FINGERPRINT` so other devices load the same template into their own free slot and report back via `/api/devices/sync-mapping-callback`. See `docs/API-workflows.md §1` for the full sequence.
* **Per-device Slot Mapping:** Sensors are physically slot-addressed (JM-101 supports 1023 slots). The `Mapping` table records `(device_id, employee_id, fingerprint_id)` with `@@unique([device_id, fingerprint_id])` and `@@unique([device_id, employee_id])` so each device has at most one slot per employee. Slot numbers may differ across devices for the same employee.
* **Check-in Resolution:** At check-in, firmware reports `(mac_addr, fingerprint_id)`. Backend looks up `Mapping(device_id, fingerprint_id)` to resolve `employee_id`. If the mapping is missing (ghost template on sensor), backend returns `{status:"invalid_credential", action:"FORCE_DELETE_LOCAL", local_id}` so the sensor self-heals. RFID resolution uses `Employee.rfid_tag`. Without a valid mapping or tag, the scan is rejected — there is no "Unknown Device ID" log row.
* **Removal:** `DELETE /api/employees/:id/credentials?type=FINGERPRINT|RFID`. For fingerprint, the DB transaction snapshots all `(mac_addr, slot)` pairs, deletes mappings, clears `Employee.template_fingerprint`, then fire-and-forget publishes `DELETE_FINGER` per device. Offline devices self-heal on next check-in via the ghost path.

---

## 3. Mathematical Models & Overlap Logic (Core Engine)

To resolve the "negative time" and "fixed break deduction" risks, the system uses an Overlap Function. All times are evaluated in **Seconds**.

Overlap(A_start, A_end, B_start, B_end) = max(0, min(A_end, B_end) - max(A_start, B_start))

### 3.1. Standard Work Calculation (Capped at 18:30)
To prevent standard work logic from bleeding into the OT block, we cap the effective check-out time for standard calculation at `18:30:00`.

T_out_std = min(T_out, 18:30:00)
S_lunch_overlap = Overlap(T_in, T_out_std, 12:00:00, 13:30:00)
S_work = (T_out_std - T_in) - S_lunch_overlap
Daily_Credit = min(1.0, S_work / 28800)

### 3.2. Overtime (OT) Calculation
OT strictly begins at `18:30:00`. 
If T_out <= 18:30:00, then OT_Credit = 0. Otherwise, establish the OT start boundary and deduct the overlapping dinner time.

OT_in = max(T_in, 18:30:00)
S_dinner_overlap = Overlap(OT_in, T_out, 18:30:00, 20:00:00)
S_OT_actual = (T_out - OT_in) - S_dinner_overlap
OT_Credit = min(S_OT_actual, S_OT_registered) / 28800

---
