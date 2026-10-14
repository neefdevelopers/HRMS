# Multi-Company Human Resource Management System (HRMS) SaaS Platform

An enterprise-grade, **Multi-Company HRMS SaaS Application** built with **Node.js**, **Express**, **TypeScript**, **Prisma ORM**, **SQLite**, **React (Vite)**, and **Tailwind CSS**.

Transformed from a single-group multi-brand HRMS into a multi-company SaaS platform where multiple independent companies operate on the same platform while keeping their records, settings, and operations strictly isolated.

---

## 🏛️ Organizational Hierarchy

The platform implements a strict 7-level multi-tenant hierarchy:

$$\text{Platform} \longrightarrow \text{Companies} \longrightarrow \text{Brands} \longrightarrow \text{Branches} \longrightarrow \text{Departments} \longrightarrow \text{Designations} \longrightarrow \text{Employees}$$

* **Platform**: The top-level administrative layer managed by Platform Super Admins.
* **Company**: An independent customer organization (tenant) using the HRMS with its own branding, brands, branches, staff, payroll, assets, and system settings.
* **Brands & Branches**: Operational business divisions and physical work sites belonging to a specific company.
* **Departments & Designations**: Functional business units and role titles within each company division.
* **Employees**: Individual staff members bound strictly to their company scope.

---

## 🚀 Key Modules & Capabilities

### 1. SaaS Company Management (Platform Super Admin)
* **Company Registry (`/companies`)**: View all registered customer organizations with search by name, code, or email, and active/inactive status filters.
* **Company Lifecycle**: Register new companies, edit contact and registration particulars, and activate/deactivate companies in real time.
* **Tenant Overview**: Real-time drilldown inspecting company brand distribution, active employee headcount, connected punch terminals, active exit clearances, and assigned administrators.
* **Administrator Provisioning**: Provision or assign dedicated Company Administrators directly to tenant companies.
* **One-Click Workspace Switching**: Platform Super Admins can switch context seamlessly into any tenant company workspace directly from the navigation bar.

### 2. Multi-Company Authentication & Tenant Switching
* **Server-Validated Active Company**: Active company resolved from database memberships (`CompanyMembership`). Client headers (`X-Company-Id`) are validated on every request.
* **Automatic vs. Manual Selection**: Single-company users are automatically routed to their organization. Multi-company users and Super Admins get an instant dropdown company switcher in the application header.
* **Company Branding**: Header displays the active company badge alongside brand selectors.

### 3. HR Dashboard & Operational Analytics
* **Platform Super Admin View**: Consolidated platform overview showing total registered companies, active tenant distributions, and system-wide metrics.
* **Company Admin & HR View**: Scoped workforce analytics including Total Active Headcount, Present Today, Absent, Late Arrivals, On Approved Leave, and New Joiners within their company.
* **Brand-Level Filtering**: Multi-brand filtering scoped strictly to brands belonging to the active company.

### 4. Employee Master Directory & Profiles
* **Company-Scoped Master**: Full employee lifecycle management isolated by company boundary.
* **Scoped Business IDs**: Employee IDs (`EMP-XXXX`) and Biometric IDs (`BIO-XXXX`) are unique within each company (`@@unique([companyId, employeeId])`), allowing independent companies to use their own numbering schemes.
* **360° Employee Profile**: Tabbed profile displaying personal details, shift assignments, real-time punch history, leave balances, payroll history, assigned assets, and uploaded compliance documents.

### 5. Biometric Attendance Calculation Engine
* **Device Scoping**: Biometric terminals assigned to specific companies and branches to prevent cross-company punch ingestion.
* **Hardware Sync Adapter**: Extensible `IPunchingDeviceAdapter` supporting real-time terminal sync and webhook ingestion.
* **Smart Punch Deduplication**: Automatic 60-second duplicate punch deduplication.
* **Automated Shift Logic**: Shift evaluations, configurable grace periods, half-day/full-day thresholds, night shifts, and overtime tracking.

### 6. Leaves & Approvals Workflow
* **Company Leave Policies**: Configurable leave policies (Casual, Sick, Earned/Privilege) with annual allocations and carry-forward rules scoped by company.
* **Approval Routing**: Two-tier review queue routing requests strictly to managers and HR personnel within the same company.
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

### 11. System Settings & Enterprise Integrations
* **Platform vs. Company Settings**: Platform configuration separated from company-specific attendance rules, leave policies, shifts, and payroll settings.

---

## 👥 Roles and Permissions

The platform supports 6 user roles with predefined demo accounts (Default password: `password123`):

| Role | Email | Company | Scope & Permissions |
| :--- | :--- | :--- | :--- |
| **Platform Super Admin** | `superadmin@hrms.local` | Platform-wide | Manage all companies, view platform stats, switch company workspaces |
| **Company Admin** | `admin@betalogistics.com` | Beta Logistics Inc. | Manage assigned company, brands, staff, settings, and users (Password: `BetaAdmin123!`) |
| **Company HR** / **Group HR** | `grouphr@hrms.local` | Apex Group Enterprises | Manage employees, attendance, leave, salary, and exits across all company brands |
| **Brand HR** | `apex.hr@hrms.local` | Apex Group Enterprises | Full HR operations for assigned brand (Apex Retail Group) |
| **Manager** | `manager.apex@hrms.local` | Apex Group Enterprises | Team attendance, leave approvals, exit asset clearance for assigned team |
| **Employee** | `employee.apex@hrms.local` | Apex Group Enterprises | Self-service attendance, leave requests, salary receipts, resignation |

*Note: One-click demo login buttons are available on the login page for instant testing of roles.*

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
| | `POST` | `/api/companies/:id/admins` | Assign/invite company administrator |
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
| **Notifications** | `GET` | `/api/notifications` | Paginated user notifications |
| | `GET` | `/api/notifications/unread-count` | Real-time unread badge count |
| | `PATCH`| `/api/notifications/:id/read` | Mark individual notification read |
| | `PATCH`| `/api/notifications/read-all` | Mark all notifications read |

---

## 🔒 Security & Data Integrity
* **JWT Authentication**: Secure Bearer tokens with user role and branch/brand context.
* **Role-Based Access Control (RBAC)**: Backend-enforced route authorization with strict error codes (`401 Unauthorized`, `403 Forbidden`).
* **Tenant Isolation**: Query scoping guarantees that users cannot access records outside their authorized brand.
* **Immutable Auditing**: Key financial and operational events (salary adjustments, attendance corrections, exit approvals) generate immutable `AuditLog` records.
