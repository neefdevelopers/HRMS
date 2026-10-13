# Multi-Brand Human Resource Management System (HRMS) MVP

An enterprise-grade, multi-brand **Human Resource Management System (HRMS)** built with Node.js, Express, TypeScript, Prisma ORM, React, and Tailwind CSS.

## 🚀 Key Modules & Architecture

### Module 1: HR Dashboard
- **9 Core KPI Cards:**
  - **Total Employees**: Real-time active headcount excluding inactive and terminated staff.
  - **Brand-wise Employee Count**: Proportional workforce breakdown across operating divisions.
  - **Present Today**: Employees satisfying attendance criteria with percentage calculations.
  - **Absent Today**: Deductive absence metric accounting for approved leave and non-working days.
  - **Late Employees**: Employees exceeding configured shift start times and grace periods.
  - **Employees on Leave**: Approved leave records covering the selected date.
  - **New Joiners**: Recent onboarding cohort with direct employee directory navigation.
  - **Pending Approvals**: Live queue for leave and attendance regularizations.
  - **Monthly Payroll Summary**: Finalized gross/net summaries with role-based visibility.
- **Dedicated Attendance Overview Section**:
  - 7-Day Trend Chart & Status Distribution Breakdown via Recharts.
  - Attendance Details Registry with search, status filters, and manual HR correction modal.

### Module 2 & 4: Multi-Brand & Organization Management
- Strict multi-brand isolation enforced at the database and API middleware levels.
- Super Admin & Group HR can toggle between consolidated group view and individual brands.
- Brand HR, Managers, and Employees are strictly restricted to their assigned brand.
- Hierarchical structure: Brands -> Branches -> Departments -> Designations -> Shifts.

### Module 3: Employee Management
- Complete employee master CRUD.
- Unique business Employee ID (`EMP-XXXX`) and biometric hardware ID (`BIO-XXXX`) validation.
- Shift assignments, reporting manager relationships, and leave balance initialization.

### Module 5 & 6: Biometric Punching & Attendance Calculation Engine
- Dedicated `IPunchingDeviceAdapter` architecture supporting production biometric gateways and development mock adapters.
- Hardware punch synchronization engine (`PunchSyncService`).
- 60-second duplicate punch deduplication.
- Shift grace periods, working hours computation, late penalty calculation, and half-day thresholds.
- Manual HR correction with audit logging.

### Module 7: Leave & Approvals Workflow
- Configurable leave policies (Casual, Sick, Earned/Privilege).
- Leave request submission with overlap prevention.
- Review queue (Approve/Reject) for authorized Managers and HR.
- Approved leave immediately updates attendance registers so employees on leave are not classified as absent.

### Module 8: Role-Based Access Control (RBAC)
- **Super Admin** (`superadmin@hrms.local`): Full enterprise configuration and multi-brand group view.
- **Group HR** (`grouphr@hrms.local`): Cross-brand workforce monitoring and approvals.
- **Brand HR** (`apex.hr@hrms.local`): Dedicated HR operations for assigned brand (Apex Retail).
- **Employee** (`employee.apex@hrms.local`): Self attendance, personal profile, and leave applications.
- Default password for all seed accounts: `password123`

### Module 9: Salary Processing & Salary Receipts
- **Effective-Dated Salary Configuration**:
  - Employee-specific fixed monthly salary, currency (INR), schedule basis (standard working days and hours/day).
  - Effective dates (`effectiveFrom`, `effectiveUntil`) preventing accidental modifications to prior periods.
  - Overtime calculation methods (`STANDARD_HOURLY`, `CUSTOM_RATE`, `NONE`).
  - Incomplete working hours deduction methods (`STANDARD_HOURLY`, `CUSTOM_RATE`, `NONE`).
- **Calculation Engine**:
  - Net Payable Salary = (Payable Fixed Salary + Approved OT Pay + Approved Incentives + Additional Earnings) − (Incomplete Hours Deductions + Other Deductions).
  - Prorated salary for mid-month joiners/leavers based on active days in the month.
  - Short-hour deduction calculation based on scheduled working days, excluding approved leaves, holidays, and week-offs.
  - Missing punch data detection and warning flags.
  - Optional fixed and percentage-based incentives with approval review.
- **Salary Processing & Review**:
  - Draft computation, HR audit adjustments (override OT hours, incomplete hours, remarks), and single/bulk approval.
  - Multi-brand authorization and brand switching protection.
- **Official Salary Receipts & Server-Side PDF**:
  - Atomic finalization issuing sequential receipts (`REC-{BRAND}-{PERIOD}-{EMP}`).
  - Immutable frozen snapshot for legal integrity.
  - Server-side PDF generation via `PDFKit` with itemized earnings, deductions, working hours, and amount in words.
  - Role-gated PDF download (HR can download for authorized brand, employees can download only their own).

---

## 🛠️ Setup & Running Locally

### 1. Install Dependencies
```bash
# In the root folder
npm run install:all
```
*(Or navigate into `server` and run `npm install`, then into `client` and run `npm install`)*

### 2. Initialize Database & Seed
```bash
cd server
npm run prisma:push
npm run prisma:seed
```

### 3. Start Development Servers
From the root folder:
```bash
# Terminal 1: Backend API (port 5000)
npm run server

# Terminal 2: Frontend Client (port 5173)
npm run client
```

Navigate to `http://localhost:5173` in your browser. One-click demo login buttons are provided on the login page for effortless testing of every role!
