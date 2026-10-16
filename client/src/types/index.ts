export type Role = 'ADMIN' | 'HR' | 'ATTENDANCE_VIEWER';

export interface HrAssignment {
  membershipId: string;
  companyId: string;
  companyName: string;
  companyCode: string;
  isCompanyActive: boolean;
  role?: Role;
  isActive: boolean;
}

export interface HrUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  role: Role;
  createdAt: string;
  assignments: HrAssignment[];
}

export interface Company {
  id: string;
  name: string;
  code: string;
  logo?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  registrationNumber?: string | null;
  taxNumber?: string | null;
  role?: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    brands?: number;
    employees?: number;
    memberships?: number;
    departments?: number;
  };
}

export interface CompanyMembership {
  id: string;
  userId: string;
  companyId: string;
  role: Role;
  isActive: boolean;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
  company?: Company;
  user?: User;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  platformRole?: Role;
  firstName: string;
  lastName: string;
  phone?: string | null;
  companyId?: string | null;
  activeCompany?: Company | null;
  companies?: Company[];
  brandId?: string | null;
  branchId?: string | null;
  employeeId?: string | null;
  company?: Company | null;
  brand?: Brand | null;
  branch?: Branch | null;
  employee?: Employee | null;
  memberships?: CompanyMembership[];
}

export interface Brand {
  id: string;
  name: string;
  code: string;
  companyName: string;
  companyId: string;
  company?: Company;
  logo?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isActive: boolean;
  branches?: Branch[];
  _count?: {
    employees: number;
    branches: number;
    departments: number;
  };
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  brandId: string;
  city: string;
  state?: string | null;
  country: string;
  address?: string | null;
  phone?: string | null;
  isActive: boolean;
  brand?: Brand;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  brandId: string;
  description?: string | null;
  isActive: boolean;
}

export interface Designation {
  id: string;
  title: string;
  code: string;
  brandId: string;
  departmentId?: string | null;
  description?: string | null;
}

export interface Shift {
  id: string;
  name: string;
  code: string;
  brandId: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  weeklyOff?: string;
  gracePeriodMinutes: number;
  halfDayThresholdHours?: number;
  fullDayThresholdHours?: number;
  isNightShift: boolean;
  isDefault?: boolean;
  expectedWorkingHours?: number;
  brand?: Brand;
  _count?: {
    employees: number;
    assignments: number;
  };
}

export interface ShiftAssignment {
  id: string;
  employeeId: string;
  shiftId: string;
  brandId: string;
  startDate: string;
  endDate?: string | null;
  isRotational: boolean;
  rotationFrequency?: 'WEEKLY' | 'MONTHLY' | null;
  rotationShiftIds?: string | null;
  rotationShifts?: string[];
  notes?: string | null;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    department?: { name: string };
    brand?: { name: string };
  };
  shift?: Shift;
}

export interface ShiftCalendarScheduleItem {
  date: string;
  shiftId: string;
  shiftName: string;
  shiftCode: string;
  startTime: string;
  endTime: string;
  isNightShift: boolean;
  isWeeklyOff: boolean;
  isRotational: boolean;
}

export interface ShiftCalendarRosterItem {
  employee: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    department?: string;
    designation?: string;
    brand?: string;
  };
  schedule: Record<string, ShiftCalendarScheduleItem>;
}

export interface ShiftCalendarData {
  period: string;
  daysInMonth: number;
  dates: string[];
  totalEmployees: number;
  roster: ShiftCalendarRosterItem[];
}

export interface ShiftWiseAttendanceRecord {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  date: string;
  shift: {
    id: string;
    name: string;
    code: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    weeklyOff: string;
    isNightShift: boolean;
    expectedWorkingHours: number;
  };
  checkIn: string | null;
  checkOut: string | null;
  workingHours: number;
  expectedHours: number;
  lateMinutes: number;
  incompleteHours: number;
  overtimeHours: number;
  status: string;
  isWeeklyOff: boolean;
  isOvernight: boolean;
}

export interface ShiftAttendanceData {
  date: string;
  totalEmployees: number;
  records: ShiftWiseAttendanceRecord[];
}

export interface Employee {
  id: string;
  employeeId: string;
  brandId: string;
  branchId: string;
  departmentId: string;
  designationId: string;
  shiftId?: string | null;
  reportingManagerId?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  profilePhoto?: string | null;
  dateOfBirth?: string | null;
  joiningDate: string;
  employmentType: string;
  employeeStatus: 'ACTIVE' | 'INACTIVE' | 'PROBATION' | 'SUSPENDED' | 'TERMINATED';
  biometricId?: string | null;
  monthlySalary?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  exitDate?: string | null;
  brand?: Brand;
  branch?: Branch;
  department?: Department;
  designation?: Designation;
  shift?: Shift;
  reportingManager?: Employee | null;
  documents?: EmployeeDocument[];
  shiftAssignments?: ShiftAssignment[];
}

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  brandId: string;
  title: string;
  category: 'ID_PROOF' | 'CONTRACT' | 'ACADEMIC' | 'CERTIFICATE' | 'TAX' | 'GENERAL' | string;
  fileName: string;
  fileType?: string | null;
  fileSize?: number | null;
  fileUrl: string;
  description?: string | null;
  uploadedById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyAttendanceSummary {
  month: string;
  totalLoggedDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  weekOffDays: number;
  lateDays: number;
  totalWorkingHours: number;
  totalOvertimeHours: number;
  totalIncompleteHours: number;
}

export interface EmployeeCompleteProfile {
  employee: Employee;
  attendanceHistory: Attendance[];
  punchHistory: Array<{
    id: string;
    biometricId: string;
    punchTime: string;
    punchType: string;
    verificationType: string;
    device?: { deviceName: string; location?: string | null } | null;
  }>;
  attendanceSummary: MonthlyAttendanceSummary;
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveRequest[];
  payrolls: EmployeePayroll[];
  documents: EmployeeDocument[];
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEK_OFF';

export interface Attendance {
  id: string;
  employeeId: string;
  brandId: string;
  branchId: string;
  date: string;
  shiftId?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  workingHours: number;
  status: AttendanceStatus;
  lateMinutes: number;
  earlyExitMinutes: number;
  isRegularized: boolean;
  isManualCorrection: boolean;
  remarks?: string | null;
  employee?: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    department?: { name: string };
    designation?: { title: string };
  };
  brand?: { id: string; name: string; code: string };
  branch?: { id: string; name: string };
  shift?: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    fullDayThresholdHours?: number;
    breakMinutes?: number;
    weeklyOff?: string;
  };
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  brandId: string;
  daysPerYear: number;
  isPaid: boolean;
  carryForward?: boolean;
  maxCarryForwardDays?: number;
  accrualRule?: string;
  requiresApproval?: boolean;
  description?: string | null;
  brand?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  totalAllocated: number;
  used: number;
  pending: number;
  remaining: number;
  leaveType?: LeaveType;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  brandId: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  appliedAt: string;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    department?: { name: string };
    brand?: { name: string };
  };
  leaveType?: LeaveType;
}

export interface DailyLeaveRecord {
  id: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDayType?: string | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  rejectionReason?: string | null;
  appliedAt: string;
  reviewedAt?: string | null;
  employee?: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    department?: { id: string; name: string } | null;
    designation?: { id: string; title: string } | null;
    branch?: { id: string; name: string } | null;
  };
  brand?: {
    id: string;
    name: string;
    code: string;
  };
  leaveType?: {
    id: string;
    name: string;
    code: string;
    isPaid: boolean;
  };
}

export interface DailyLeaveSummary {
  totalApproved: number;
  fullDayApproved: number;
  halfDayApproved: number;
  totalPending: number;
  totalRejected: number;
  totalRecords: number;
}

export interface DailyLeavesData {
  date: string;
  summary: DailyLeaveSummary;
  leaves: DailyLeaveRecord[];
}

export interface DashboardMetrics {
  selectedDate: string;
  kpis: {
    totalEmployees: number;
    presentToday: {
      count: number;
      percentage: number;
    };
    absentToday: {
      count: number;
      percentage: number;
    };
    lateEmployees: {
      count: number;
    };
    employeesOnLeave: {
      count: number;
    };
    newJoinersCount: number;
    pendingApprovalsCount: number;
  };
  brandDistribution: Array<{
    brandId: string;
    brandName: string;
    brandCode: string;
    count: number;
    percentage: number;
  }>;
  attendanceDistribution: {
    present: number;
    absent: number;
    late: number;
    onLeave: number;
    halfDay: number;
  };
  attendanceTrend: Array<{
    date: string;
    day: string;
    present: number;
    absent: number;
    late: number;
    onLeave: number;
  }>;
  newJoiners: Array<{
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    joiningDate: string;
    department?: { name: string };
    brand?: { name: string };
    designation?: { title: string };
  }>;
  pendingApprovals: Array<{
    id: string;
    status: string;
    reason: string;
    startDate: string;
    endDate: string;
    employee: {
      firstName: string;
      lastName: string;
      employeeId: string;
      department?: { name: string };
      brand?: { name: string };
    };
    leaveType?: { name: string };
  }>;
  payrollSummary?: {
    configured: boolean;
    period?: string;
    totalEmployees?: number;
    totalGross?: number;
    totalNet?: number;
    status?: string;
    brandName?: string;
    message?: string;
  } | null;
}

export interface EmployeeSalaryConfig {
  id: string;
  employeeId: string;
  brandId: string;
  monthlySalary: number;
  standardWorkingDays: number;
  standardWorkingHoursPerDay: number;
  currency: string;
  effectiveFrom: string;
  effectiveUntil?: string | null;
  otCalculationMethod: string;
  otRatePerHour: number;
  incompleteHoursDeductionMethod: string;
  incompleteDeductionRatePerHour: number;
  status: string;
  employee?: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    joiningDate: string;
    employeeStatus: string;
    branch?: { id: string; name: string };
    department?: { id: string; name: string };
    designation?: { id: string; title: string };
  };
  brand?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface Incentive {
  id: string;
  employeeId: string;
  brandId: string;
  payrollMonth: string;
  title: string;
  amount: number;
  incentiveType: string;
  calculationBase: string;
  calculatedAmount: number;
  reason?: string | null;
  status: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  employee?: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    department?: { name: string };
  };
}

export interface OvertimeRecord {
  id: string;
  employeeId: string;
  brandId: string;
  date: string;
  payrollMonth: string;
  hours: number;
  otRate: number;
  otAmount: number;
  reason?: string | null;
  status: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  employee?: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    department?: { name: string };
  };
}

export interface PayrollAdjustment {
  id: string;
  employeeId: string;
  brandId: string;
  payrollMonth: string;
  type: string;
  amount: number;
  reason: string;
  status: string;
  employee?: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
  };
}

export interface EmployeePayroll {
  id: string;
  payrollPeriodId: string;
  employeeId: string;
  brandId: string;
  salaryConfigId?: string | null;
  currency: string;
  baseSalary: number;
  payableSalary: number;
  standardWorkingDays: number;
  standardWorkingHoursPerDay: number;
  payableWorkingHours: number;
  eligibleWorkingHours: number;
  approvedOtHours: number;
  otRate: number;
  otPayment: number;
  incompleteHours: number;
  incompleteDeductionRate: number;
  incompleteDeductionAmount: number;
  approvedIncentivesAmount: number;
  additionalEarnings: number;
  otherDeductions: number;
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
  status: string;
  presentDaysCount: number;
  leaveDaysCount: number;
  absentDaysCount: number;
  hasMissingPunchFlags: boolean;
  calculationBreakdownJson?: string | null;
  snapshotConfigJson?: string | null;
  remarks?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  finalizedById?: string | null;
  finalizedAt?: string | null;
  employee?: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    department?: { name: string };
    designation?: { title: string };
    branch?: { name: string };
  };
  brand?: {
    id: string;
    name: string;
    code: string;
  };
  payrollPeriod?: {
    id?: string;
    period: string;
  };
  receipt?: SalaryReceipt | null;
}

export interface SalaryReceipt {
  id: string;
  employeePayrollId: string;
  receiptNumber: string;
  issueDate: string;
  paymentDate?: string | null;
  netSalary: number;
  amountInWords: string;
  snapshotJson: string;
  downloadCount: number;
  createdAt: string;
  employeePayroll?: EmployeePayroll;
}

export interface SalaryDashboardData {
  period: string;
  totalEmployees: number;
  configuredEmployeesCount: number;
  totalFixedSalary: number;
  totalOvertimePayable: number;
  totalApprovedIncentives: number;
  totalIncompleteDeductions: number;
  totalNetSalary: number;
  statusCounts: {
    draft: number;
    pendingReview: number;
    approved: number;
    finalized: number;
    totalCalculated: number;
  };
  periods: Array<{
    id: string;
    period: string;
    startDate: string;
    endDate: string;
    status: string;
    _count?: { payrolls: number };
  }>;
}

export type AssetStatus = 'AVAILABLE' | 'ASSIGNED' | 'DAMAGED';
export type AssetType = 'LAPTOP' | 'MOBILE' | 'TABLET' | 'MONITOR' | 'OTHER';

export interface AssetAssignmentHistory {
  id: string;
  assetId: string;
  employeeId: string;
  assignedDate: string;
  returnedDate?: string | null;
  assignedById?: string | null;
  returnNotes?: string | null;
  conditionOnReturn?: string | null;
  createdAt: string;
  employee?: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
  };
}

export interface Asset {
  id: string;
  brandId: string;
  name: string;
  type: AssetType | string;
  assetTag: string;
  serialNumber?: string | null;
  brandModel?: string | null;
  purchaseDate?: string | null;
  status: AssetStatus;
  assignedEmployeeId?: string | null;
  assignedDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  brand?: {
    id: string;
    name: string;
    code: string;
  };
  assignedEmployee?: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    department?: { name: string };
    designation?: { title: string };
  } | null;
  assignmentHistory?: AssetAssignmentHistory[];
}

export type DocumentType =
  | 'CONTRACT'
  | 'CERTIFICATE'
  | 'OFFER_LETTER'
  | 'APPOINTMENT_LETTER'
  | 'EXPERIENCE_LETTER'
  | 'RELIEVING_LETTER'
  | 'OTHER';

export interface CompanyDocument {
  id: string;
  brandId: string;
  employeeId: string;
  title: string;
  documentType: DocumentType | string;
  category: string;
  fileName: string;
  fileType?: string | null;
  fileSize?: number | null;
  fileUrl: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  remarks?: string | null;
  description?: string | null;
  isArchived: boolean;
  replacedById?: string | null;
  reminder30Sent: boolean;
  reminder7Sent: boolean;
  uploadedById?: string | null;
  createdAt: string;
  updatedAt: string;
  daysUntilExpiry?: number;
  isExpired?: boolean;
  isExpiringSoon7?: boolean;
  isExpiringSoon30?: boolean;
  employee?: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email?: string;
    department?: { name: string };
    designation?: { title: string };
  };
  brand?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface DocumentExpirySummary {
  today: string;
  counts: {
    totalTracked: number;
    expired: number;
    expiringSoon7: number;
    expiringSoon30: number;
    activeValid: number;
  };
  expired: CompanyDocument[];
  expiringSoon7: CompanyDocument[];
  expiringSoon30: CompanyDocument[];
  activeValid: CompanyDocument[];
}

// System Settings Types
export interface CompanySettings {
  companyName: string;
  companyLogo?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxRegistrationNumber?: string;
}

export interface BrandWorkingHoursRule {
  brandId: string;
  brandName?: string;
  brandCode?: string;
  maleDailyHours: number;
  femaleDailyHours: number;
}

export interface AttendanceRules {
  requiredDailyHours: number;
  defaultMaleDailyHours: number;
  defaultFemaleDailyHours: number;
  lateGracePeriodMinutes: number;
  halfDayThresholdHours: number;
  incompleteHoursDeductionEnabled: boolean;
  minHoursForPresent: number;
  autoMarkAbsentIfNoCheckIn: boolean;
  brandRules?: BrandWorkingHoursRule[];
}

export interface LeavePolicies {
  maxCarryForwardDays: number;
  accrualFrequency: 'YEARLY' | 'MONTHLY' | string;
  allowNegativeBalance: boolean;
  probationLeaveAllowed: boolean;
}

export interface ShiftRules {
  defaultShiftId?: string;
  defaultBreakMinutes: number;
  allowOvernightShifts: boolean;
  defaultWeeklyOff: string;
  maxConsecutiveWorkingDays: number;
}

export interface PayrollSettings {
  defaultOtMultiplier: number;
  otCalculationMethod: 'STANDARD_MULTIPLIER' | 'CUSTOM_RATE' | 'NONE' | string;
  customOtRatePerHour: number;
  incompleteDeductionMethod: 'HOURLY_PRORATED' | 'CUSTOM_RATE' | 'NONE' | string;
  customIncompleteRatePerHour: number;
  incentiveApprovalRule: 'REQUIRE_HR_APPROVAL' | 'AUTO_APPROVED' | string;
  payrollCutoffDay: number;
  payrollCycle: 'CALENDAR_MONTH' | '26_TO_25' | string;
  standardWorkingDaysPerMonth: number;
}

export interface PunchingDeviceSetting {
  id: string;
  deviceName: string;
  serialNumber: string;
  ipAddress?: string | null;
  port?: number | null;
  location?: string | null;
  brandId: string;
  branchId: string;
  status: string; // ONLINE, OFFLINE, ERROR
  isActive: boolean;
  apiSecret?: string | null;
  lastHeartbeat?: string | null;
  createdAt: string;
  brand?: { id: string; name: string; code: string };
  branch?: { id: string; name: string; code: string };
  _count?: { mappings: number; punchRecords: number };
}

export interface ApiSettings {
  biometricWebhookUrl: string;
  biometricApiKey?: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure: boolean;
  notificationWebhookUrl?: string;
  hasBiometricKey?: boolean;
  hasSmtpPassword?: boolean;
}

export interface SystemSettingsData {
  company: CompanySettings;
  brands: Brand[];
  attendance: AttendanceRules;
  leave: {
    policies: LeavePolicies;
    types: LeaveType[];
  };
  shift: {
    rules: ShiftRules;
    shifts: Shift[];
  };
  payroll: PayrollSettings;
  devices: PunchingDeviceSetting[];
  api: ApiSettings;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  status?: number;
}

// Exit Management Types
export type ExitRequestStatus =
  | 'PENDING_APPROVAL'
  | 'NOTICE_PERIOD'
  | 'NOTICE_COMPLETED'
  | 'EXIT_COMPLETED'
  | 'REJECTED'
  | 'WITHDRAWN';

export interface ExitRequest {
  id: string;
  employeeId: string;
  brandId: string;
  resignationDate: string;
  reason: string;
  proposedLastWorkingDay: string;
  noticePeriodDays: number;
  lastWorkingDay: string;
  employeeRemarks?: string | null;
  hrRemarks?: string | null;
  status: ExitRequestStatus;
  effectiveStatus?: ExitRequestStatus;
  remainingNoticeDays?: number;

  approvedAt?: string | null;
  approvedById?: string | null;
  rejectedAt?: string | null;
  rejectedById?: string | null;
  withdrawnAt?: string | null;
  withdrawnById?: string | null;
  withdrawnReason?: string | null;

  handoverCompleted: boolean;
  tasksHandedOver: boolean;
  docsHandedOver: boolean;
  hrClearanceCompleted: boolean;
  checklistNotes?: string | null;
  checklistCompletedAt?: string | null;
  checklistCompletedById?: string | null;

  assetClearanceCompleted: boolean;
  assetClearanceNotes?: string | null;
  assetClearedAt?: string | null;
  assetClearedById?: string | null;

  relievingLetterIssued: boolean;
  relievingLetterDocId?: string | null;
  relievingLetterIssuedAt?: string | null;

  completedAt?: string | null;
  completedById?: string | null;
  createdAt: string;
  updatedAt: string;

  employee?: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    joiningDate: string;
    employeeStatus: string;
    department?: { id: string; name: string };
    designation?: { id: string; title: string };
    branch?: { id: string; name: string; city?: string };
  };
  brand?: {
    id: string;
    name: string;
    code: string;
    companyName?: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
}

export interface ExitMetrics {
  totalRequests: number;
  pendingApprovals: number;
  servingNotice: number;
  pendingAssetClearance: number;
  exitsCompleted: number;
}

export interface ExitDashboardData {
  metrics: ExitMetrics;
  requests: ExitRequest[];
}

export interface RelievingLetterPreview {
  referenceNumber: string;
  issueDate: string;
  companyName: string;
  brandName: string;
  brandAddress?: string | null;
  brandPhone?: string | null;
  brandEmail?: string | null;
  employeeName: string;
  employeeId: string;
  department: string;
  designation: string;
  branch: string;
  joiningDate: string;
  lastWorkingDay: string;
  hrRemarks?: string | null;
  relievingLetterIssued: boolean;
  relievingLetterDocId?: string | null;
  relievingLetterIssuedAt?: string | null;
}

// In-App Notification Types
export type NotificationType =
  | 'LEAVE'
  | 'ATTENDANCE'
  | 'SALARY'
  | 'EMPLOYEE'
  | 'EXIT'
  | 'HR_MANAGEMENT'
  | 'SYSTEM'
  | 'INFO';

export interface NotificationItem {
  id: string;
  userId: string;
  companyId?: string | null;
  company?: {
    id: string;
    name: string;
    code: string;
    logo?: string | null;
  } | null;
  title: string;
  message: string;
  type: NotificationType;
  module?: string | null;
  recordId?: string | null;
  actionUrl?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unreadCount: number;
}

