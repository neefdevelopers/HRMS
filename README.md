# Multi-Company Human Resource Management System (HRMS) SaaS Platform

An enterprise-grade, **Multi-Company HRMS SaaS Application** built with **Node.js**, **Express**, **TypeScript**, **Prisma ORM**, **SQLite**, **React (Vite)**, and **Tailwind CSS**.

The system operates with **exactly three application roles**: **`ADMIN`**, **`HR`**, and **`ATTENDANCE_VIEWER`**. Multiple independent companies run on the platform while keeping their records, settings, and operations strictly isolated. Application access and permissions are strictly determined by explicit database company assignments (`CompanyMembership`).

---

## 🏛️ Three-Role Application Architecture

| Application Role | Platform & Company Scope | Key Responsibilities & Capabilities |
| :--- | :--- | :--- |
| **`ADMIN`** | Platform-wide & All Companies | Registers, edits, activates, and deactivates companies; creates HR and Attendance Viewer accounts; provisions company assignments with company-specific roles; manages organizational structures (brands, branches, departments, designations); switches administrative workspace into any company; manages global and company-specific settings. |
| **`HR`** | Strictly Assigned Companies | Operates daily HR workflows **only for explicitly assigned companies**; switches between assigned companies via header switcher; manages employee master records, biometric attendance, shifts, leave requests/approvals, salary processing, asset tracking, and exit clearance within authorized companies. |
| **`ATTENDANCE_VIEWER`** | Strictly Assigned Companies (Attendance & Daily Leaves) | **Read-only access strictly limited to the Attendance module** of specifically assigned companies. Can view attendance dates, punch-in/out times, working hours, late arrivals, overtime, status indicators, raw biometric punch audits, and **daily employee leave information** (leave type, duration, full/half-day coverage, approval status, and operational remarks) for the selected date. Filter attendance and leaves by date, brand, branch, and status within the assigned company. **Forbidden from all other modules** (Dashboard, Employees, Leave Management, Payroll, Assets, Documents, Exits, Reports, Settings, Notifications), and blocked from manual punch addition, device synchronization, attendance corrections, and leave applications/approvals. |

* **Zero Obsolete Roles:** The system strictly uses only `ADMIN`, `HR`, and `ATTENDANCE_VIEWER`. Obsolete roles like `EMPLOYEE` or `MANAGER` are not used as application logins.
* **Employees are Records, Not Logins:** Employees are tracked as workforce records in the HR database.
* **Company-Specific Role Assignment:** A user can hold different roles in different companies (e.g. User D is `HR` for Company A and `ATTENDANCE_VIEWER` for Company B). Role permissions are evaluated dynamically based on the active company context (`CompanyMembership.role`).
* **Strict Single Navigation for Viewer:** When an Attendance Viewer logs in, they see only a single navigation item (`Attendance`). Direct URL navigation to restricted modules displays an Access Denied view.
* **Immediate Revocation:** When an Admin removes a user's company membership or modifies their role, access updates immediately on the next request (403 Forbidden for unauthorized resources).

---

## 🚀 Key Modules & Capabilities

### 1. SaaS Company Management (Admin Only)
* **Company Registry (`/companies`)**: View all registered customer organizations with search by name, code, or email, and active/inactive status filters.
* **Company Lifecycle**: Register new companies, edit contact and registration particulars, and activate/deactivate companies in real time.
* **Tenant Overview**: Real-time drilldown inspecting company brand distribution, active employee headcount, connected punch terminals, active exit clearances, and assigned HR members.
* **One-Click Workspace Switching**: Admin users can switch context seamlessly into any company workspace directly from the navigation bar.

### 2. HR Management & Multi-Company Assignments (Admin Only)
* **HR Directory (`/hr-management`)**: Admin-only control center listing all HR user accounts, account statuses, and current company assignment badges.
* **HR Account Creation**: Provision new HR accounts with name, email, contact details, initial password, and searchable company multi-select.
* **Dynamic Assignment Management**: Add or remove company assignments at any time without recreating the account.
* **Immediate Access Revocation**: Removing an HR user's company membership immediately revokes workspace access and API permissions for that company.

### 3. Multi-Company HR Workspace Switching
* **Single-Company HR**: Automatically enters their assigned company workspace without manual selection prompts.
* **Multi-Company HR**: Header dropdown allows seamless switching between explicitly assigned companies with complete cache invalidation.
* **Unassigned HR**: Clear, friendly empty-state card ("Account Pending Company Assignment") explaining that an Administrator must assign them to a company, preventing crashes or blank screens.
* **Server-Side Token Validation**: Every request validates membership against the current database state; client-supplied `X-Company-Id` headers are strictly verified.

### 4. Employee Master Directory & Profiles
* **Company-Scoped Master**: Full employee lifecycle management isolated by company boundary.
* **Scoped Business IDs**: Employee IDs (`EMP-XXXX`) and Biometric IDs (`BIO-XXXX`) are unique within each company (`@@unique([companyId, employeeId])`), allowing independent companies to use their own numbering schemes.
* **360° Employee Profile**: Tabbed profile displaying personal details, shift assignments, real-time punch history, leave balances, payroll history, assigned assets, and uploaded compliance documents.

### 5. Biometric Attendance Calculation Engine & Daily Leaves
* **Device Scoping**: Biometric terminals assigned to specific companies and branches to prevent cross-company punch ingestion.
* **Hardware Sync Adapter**: Extensible `IPunchingDeviceAdapter` supporting real-time terminal sync and webhook ingestion.
* **Smart Punch Deduplication**: Automatic 60-second duplicate punch deduplication.
* **Automated Shift Logic**: Shift evaluations, configurable grace periods, half-day/full-day thresholds, night shifts, and overtime tracking.
* **Daily Employee Leave Integration**: Attendance page includes a dedicated **Employees on Leave** tab and summary KPIs (Approved on Leave, Full-Day, Half-Day, Pending Review). Multi-day leaves display across all applicable dates, and approved leave records are cleanly distinguished from ordinary absences (`ON_LEAVE` / `HALF_DAY`). Fully accessible by Attendance Viewers without granting access to the Leave Management module.

### 6. Leaves & Approvals Workflow
* **Company Leave Policies**: Configurable leave policies (Casual, Sick, Earned/Privilege) with annual allocations and carry-forward rules scoped by company.
* **Approval Routing**: Review queue routing requests strictly to authorized Admin and HR personnel within the same company.
* **Instant Attendance Integration**: Approved leave updates daily attendance registers (`ON_LEAVE` / `HALF_DAY`).

### 7. Salary Processing, Receipts & Emailing
* **Company-Scoped Payroll**: Effective-dated salary configurations, overtime multipliers, and short-hour deduction policies isolated by company.
* **Payroll Calculation Engine**:
  $$\text{Net Salary} = (\text{Base} + \text{OT Pay} + \text{Incentives} + \text{Earnings}) - (\text{Incomplete Hours} + \text{Deductions})$$
* **Server-Side PDF Receipts**: Generated via `PDFKit` issuing immutable, official salary receipt snapshots.
* **SMTP Delivery**: Tested live email delivery via SMTP with per-company credentials.

### 8. Assets Management (Company Hardware)
* **Hardware Inventory**: Track corporate laptops, mobile devices, and equipment with unique Asset Tags (`AST-XXXX`) unique per company (`@@unique([companyId, assetTag])`).
* **Cross-Company Protection**: Strictly prevents assigning assets of Company A to employees of Company B.
* **Return & Condition History**: Complete audit trail of asset assignments, returns, and damaged equipment.

### 9. Exit Management (Resignation to Relieving)
* **Exit Workflow**: Resignations, notice periods, 4-point handover checklists, and relieving letter issuance isolated by company.
* **Asset Return Clearance**: Directly queries company-owned hardware assigned to the exiting employee for return or damage processing.
* **Relieving Letter Generator**: Issues official PDF Relieving & Service Certificates via PDFKit and automatically archives them in employee documents.

### 10. Centralized In-App Notifications
* **Header Notification Bell**: Live unread count badge in the navbar with automatic 30-second polling.
* **Tenant Scoping**: All notifications are bound to `companyId` and recipient `userId` to ensure zero cross-company information leakage.

---

## 👥 Pre-Configured Demo Accounts (3 Roles)

The platform provides predefined demo accounts (Default password: `password123`):

| Role | Email | Company Assignments | Description / Use Case |
| :--- | :--- | :--- | :--- |
| **`ADMIN`** | `admin@hrms.local` | Platform-wide & All Companies | Full platform administration, company management, user provisioning, and role assignment. |
| **`HR` (Single Company)** | `hr.apex@hrms.local` | Apex Group Enterprises only | Single-company HR operator. Auto-routes directly to Apex Group workspace; cannot access Beta Logistics. |
| **`ATTENDANCE_VIEWER` (Beta)** | `viewer.a@hrms.local` | Beta Logistics Inc. only | Single-company Attendance Viewer. Read-only attendance for Beta Logistics; single navigation item; blocked from sync/corrections/other modules. |
| **`ATTENDANCE_VIEWER` (Apex)** | `viewer.b@hrms.local` | Apex Group Enterprises only | Single-company Attendance Viewer for Apex Group. Cannot access Beta Logistics records. |
| **`ATTENDANCE_VIEWER` (Multi)** | `viewer.multi@hrms.local` | Apex Group & Beta Logistics | Multi-company Attendance Viewer. Can switch between Apex and Beta; strictly read-only attendance in both companies. |
| **`HYBRID` (HR + Viewer)** | `hybrid.user@hrms.local` | HR in Beta Logistics, Viewer in Apex Group | Demonstrates company-specific roles: full HR capabilities when active company is Beta, and strictly read-only attendance when active company is Apex! |
| **`HR` (Unassigned)** | `hr.unassigned@hrms.local` | None (0 companies) | Demonstrates graceful empty state informing user to contact Admin for assignments. |

*Quick-access demo buttons for all accounts are available directly on the login page.*

---

## 🏗️ Technology Stack

```
HRMS/
├── client/                     # Frontend Application (React + Vite)
│   ├── src/
│   │   ├── components/layout/  # Navbar (with Notifications), Sidebar, AppLayout
│   │   ├── pages/              # Dashboard, Employees, Attendance, Shifts, Leave,
│   │   │                       # Salary, Assets, Documents, Exit, Notifications, Settings
│   │   ├── services/api.ts     # Centralized HTTP Client with Bearer token & meta
│   │   ├── types/index.ts      # TypeScript interfaces and domain models
│   │   └── context/            # AuthContext, BrandContext
└── server/                     # Backend Application (Node.js + Express)
    ├── prisma/
    │   ├── schema.prisma       # Complete Prisma schema (SQLite dev.db)
    │   └── seed.ts             # Multi-brand enterprise seed data
    ├── src/
    │   ├── controllers/        # Express request handlers
    │   ├── middleware/         # auth (JWT), rbac, errorHandler
    │   ├── routes/             # Modular REST API endpoints (/api/*)
    │   └── services/           # salaryCalculator, receiptPdfService, relievingLetterPdfService,
    │                           # exitService, notificationService, emailService, etc.
```

---

## 🛠️ Setup & Running Locally

### 1. Prerequisites
* **Node.js**: v18+ (tested on Node v20/v22)
* **npm**: v9+

### 2. Install Dependencies
```bash
# From the repository root
npm run install:all
```
*(Alternatively: run `npm install` in the root, `npm install` in `server/`, and `npm install` in `client/`)*

### 3. Initialize Database & Seed
```bash
# Push schema and populate initial demo data
npm run db:push
npm run seed
```

### 4. Start Development Servers
From the root directory, launch both backend and frontend concurrently:
```bash
# Runs backend on port 5000 and client on port 5173
npm run dev
```

Or start them individually:
```bash
# Terminal 1: Backend API (port 5000)
npm run server

# Terminal 2: Frontend Client (port 5173)
npm run client
```

Navigate to **`http://localhost:5173`** in your browser. Use any of the pre-configured accounts or click a demo login button to get started immediately!

---

## 📡 Core API Endpoints

| Module | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/login` | Authenticate user, issue JWT & tenant context |
| | `GET` | `/api/auth/me` | Fetch active session & accessible companies |
| **Companies** | `GET` | `/api/companies` | List all companies (Platform Super Admin only) |
| | `POST` | `/api/companies` | Register new tenant company |
| | `GET` | `/api/companies/:id` | Get company particulars & counts |
| | `GET` | `/api/companies/:id/overview` | Detailed tenant overview & admin list |
| | `PUT` | `/api/companies/:id` | Update company information |
| | `PATCH`| `/api/companies/:id/status` | Activate or deactivate company |
| **HR Management** | `GET` | `/api/hr-management` | List all HR users with company assignment details (Admin only) |
| | `POST` | `/api/hr-management` | Create HR account with multi-company assignments (Admin only) |
| | `PUT` | `/api/hr-management/:userId/companies` | Update HR user company assignments (Admin only) |
| | `PATCH`| `/api/hr-management/:userId` | Update HR account status or details (Admin only) |
| | `GET` | `/api/companies/:companyId/hr-users` | View HR users assigned to a company (Admin only) |
| **Dashboard** | `GET` | `/api/dashboard/metrics` | Fetch aggregated KPI cards & charts |
| **Employees** | `GET` | `/api/employees` | List employees (paginated, brand-scoped) |
| | `POST` | `/api/employees` | Create new employee profile |
| | `GET` | `/api/employees/:id/profile` | Comprehensive 360° profile |
| **Attendance**| `GET` | `/api/attendance` | Attendance registry with date filters |
| | `POST` | `/api/attendance/sync` | Trigger biometric hardware sync |
| | `PUT` | `/api/attendance/:id/correction` | Manual HR punch correction |
| **Leave** | `GET` | `/api/leave/requests` | List leave requests |
| | `POST` | `/api/leave/apply` | Submit leave request |
| | `PATCH`| `/api/leave/requests/:id/review`| Approve or reject leave request |
| **Salary** | `GET` | `/api/salary/overview` | Monthly payroll summary & calculations |
| | `POST` | `/api/salary/send-receipt-mail`| Generate receipt & dispatch email |
| | `GET` | `/api/salary/receipts/:id/pdf` | Download official PDF receipt |
| **Assets** | `GET` | `/api/assets` | Hardware inventory list |
| | `POST` | `/api/assets` | Register new company asset |
| | `POST` | `/api/assets/:id/assign` | Assign device to employee |
| | `POST` | `/api/assets/:id/return` | Process device return & condition |
| **Exit** | `GET` | `/api/exit/dashboard` | Exit metrics & resignation list |
| | `POST` | `/api/exit/submit` | Submit employee resignation |
| | `POST` | `/api/exit/:id/approve` | Approve resignation & start notice |
| | `PUT` | `/api/exit/:id/checklist` | Update 4-point handover checklist |
| | `POST` | `/api/exit/:id/assets/:assetId/clear` | Clear assigned company device |
| | `POST` | `/api/exit/:id/relieving-letter/issue` | Generate PDF relieving letter & archive |
| | `POST` | `/api/exit/:id/complete` | Complete exit & mark employee inactive |
| **Notifications** | `GET` | `/api/notifications` | Paginated notifications with company scoping, search, and type filters |
| | `GET` | `/api/notifications/unread-count` | Real-time unread badge count scoped by active company |
| | `PATCH`| `/api/notifications/:id/read` | Mark individual notification as read |
| | `PATCH`| `/api/notifications/:id/unread` | Toggle individual notification back to unread |
| | `PATCH`| `/api/notifications/read-all` | Mark all notifications read (optionally scoped by company) |
| | `DELETE`| `/api/notifications/:id` | Delete individual notification |
| | `DELETE`| `/api/notifications/clear-read` | Batch delete all read notifications (scoped by company) |

---

## 🔒 Security & Data Integrity
* **JWT Authentication**: Secure Bearer tokens with user role and branch/brand context.
* **Role-Based Access Control (RBAC)**: Backend-enforced route authorization with strict error codes (`401 Unauthorized`, `403 Forbidden`).
* **Tenant Isolation**: Query scoping guarantees that users cannot access records outside their authorized brand.
* **Immutable Auditing**: Key financial and operational events (salary adjustments, attendance corrections, exit approvals) generate immutable `AuditLog` records.
