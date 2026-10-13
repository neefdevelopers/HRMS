import {
  DashboardMetrics, User, Brand, Branch, Department, Designation, Shift, Employee,
  Attendance, LeaveRequest, LeaveType, EmployeeSalaryConfig, Incentive, PayrollAdjustment,
  EmployeePayroll, SalaryReceipt, SalaryDashboardData, OvertimeRecord,
  ShiftAssignment, ShiftCalendarData, ShiftAttendanceData,
  EmployeeCompleteProfile, EmployeeDocument,
  Asset, CompanyDocument, DocumentExpirySummary,
  SystemSettingsData, CompanySettings, AttendanceRules, LeavePolicies, ShiftRules,
  PayrollSettings, PunchingDeviceSetting, ApiSettings, TestConnectionResult
} from '../types';

const API_BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('hrms_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const resJson = await response.json();

  if (!response.ok || resJson.success === false) {
    const errorMsg = resJson.error || resJson.message || 'Request failed';
    throw new Error(errorMsg);
  }

  return resJson.data;
}

export const api = {
  // Auth
  login: (credentials: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),

  getMe: () => request<User>('/auth/me'),

  // Dashboard Metrics
  getDashboardMetrics: (params: { date?: string; brandId?: string; branchId?: string; departmentId?: string }) => {
    const searchParams = new URLSearchParams();
    if (params.date) searchParams.append('date', params.date);
    if (params.brandId) searchParams.append('brandId', params.brandId);
    if (params.branchId) searchParams.append('branchId', params.branchId);
    if (params.departmentId) searchParams.append('departmentId', params.departmentId);

    return request<DashboardMetrics>(`/dashboard/metrics?${searchParams.toString()}`);
  },

  // Brands & Org Structure
  getBrands: (brandId?: string) => {
    const url = brandId ? `/brands?brandId=${brandId}` : '/brands';
    return request<Brand[]>(url);
  },

  createBrand: (data: Partial<Brand>) =>
    request<Brand>('/brands', { method: 'POST', body: JSON.stringify(data) }),

  getBranches: (brandId?: string) => {
    const url = brandId && brandId !== 'all' ? `/brands/branches?brandId=${brandId}` : '/brands/branches';
    return request<Branch[]>(url);
  },

  getDepartments: (brandId?: string) => {
    const url = brandId && brandId !== 'all' ? `/brands/departments?brandId=${brandId}` : '/brands/departments';
    return request<Department[]>(url);
  },

  getDesignations: (brandId?: string) => {
    const url = brandId && brandId !== 'all' ? `/brands/designations?brandId=${brandId}` : '/brands/designations';
    return request<Designation[]>(url);
  },

  getShifts: (brandId?: string) => {
    const url = brandId && brandId !== 'all' ? `/brands/shifts?brandId=${brandId}` : '/brands/shifts';
    return request<Shift[]>(url);
  },

  // Employees
  getEmployees: (params: { page?: number; limit?: number; search?: string; brandId?: string; branchId?: string; departmentId?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params.page) sp.append('page', params.page.toString());
    if (params.limit) sp.append('limit', params.limit.toString());
    if (params.search) sp.append('search', params.search);
    if (params.brandId) sp.append('brandId', params.brandId);
    if (params.branchId) sp.append('branchId', params.branchId);
    if (params.departmentId) sp.append('departmentId', params.departmentId);
    if (params.status) sp.append('status', params.status);

    return request<Employee[]>(`/employees?${sp.toString()}`);
  },

  getEmployeeById: (id: string) => request<Employee>(`/employees/${id}`),

  getEmployeeProfile: (id: string) => request<EmployeeCompleteProfile>(`/employees/${id}/profile`),

  getEmployeeDocuments: (id: string) => request<EmployeeDocument[]>(`/employees/${id}/documents`),

  uploadEmployeeDocument: (id: string, data: {
    title: string;
    category: string;
    fileName: string;
    fileType?: string;
    fileSize?: number;
    fileUrl: string;
    description?: string;
  }) => request<EmployeeDocument>(`/employees/${id}/documents`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  deleteEmployeeDocument: (id: string, docId: string) =>
    request<{ success: boolean }>(`/employees/${id}/documents/${docId}`, { method: 'DELETE' }),

  createEmployee: (data: any) =>
    request<Employee>('/employees', { method: 'POST', body: JSON.stringify(data) }),

  updateEmployee: (id: string, data: any) =>
    request<Employee>(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Attendance & Punching
  getAttendance: (params: { date?: string; startDate?: string; endDate?: string; brandId?: string; branchId?: string; departmentId?: string; status?: string; page?: number }) => {
    const sp = new URLSearchParams();
    if (params.date) sp.append('date', params.date);
    if (params.startDate) sp.append('startDate', params.startDate);
    if (params.endDate) sp.append('endDate', params.endDate);
    if (params.brandId) sp.append('brandId', params.brandId);
    if (params.branchId) sp.append('branchId', params.branchId);
    if (params.departmentId) sp.append('departmentId', params.departmentId);
    if (params.status) sp.append('status', params.status);
    if (params.page) sp.append('page', params.page.toString());

    return request<Attendance[]>(`/attendance?${sp.toString()}`);
  },

  syncPunches: (syncType = 'MANUAL') =>
    request<{ totalFetched: number; inserted: number; duplicatesSkipped: number }>('/attendance/sync', {
      method: 'POST',
      body: JSON.stringify({ syncType })
    }),

  getPunches: (params?: { brandId?: string; deviceId?: string; page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.brandId) sp.append('brandId', params.brandId);
    if (params?.deviceId) sp.append('deviceId', params.deviceId);
    if (params?.page) sp.append('page', params.page.toString());
    if (params?.limit) sp.append('limit', params.limit.toString());
    return request<any[]>(`/attendance/punches?${sp.toString()}`);
  },

  correctAttendance: (id: string, data: { checkIn?: string; checkOut?: string; status?: string; remarks?: string }) =>
    request<Attendance>(`/attendance/${id}/correct`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  // Leaves & Approvals
  getLeaveTypes: (brandId?: string) => {
    const url = brandId && brandId !== 'all' ? `/leave/types?brandId=${brandId}` : '/leave/types';
    return request<LeaveType[]>(url);
  },

  getLeaveRequests: (brandId?: string, status?: string) => {
    const sp = new URLSearchParams();
    if (brandId && brandId !== 'all') sp.append('brandId', brandId);
    if (status) sp.append('status', status);
    return request<LeaveRequest[]>(`/leave/requests?${sp.toString()}`);
  },

  applyLeave: (data: { employeeId?: string; leaveTypeId: string; startDate: string; endDate: string; isHalfDay?: boolean; reason: string }) =>
    request<LeaveRequest>('/leave/apply', { method: 'POST', body: JSON.stringify(data) }),

  addLeave: (data: { employeeId?: string; leaveTypeId: string; startDate: string; endDate: string; reason: string }) =>
    request<LeaveRequest>('/leave/add', { method: 'POST', body: JSON.stringify(data) }),

  deleteLeave: (id: string) =>
    request<void>(`/leave/${id}`, { method: 'DELETE' }),

  reviewLeave: (id: string, status: 'APPROVED' | 'REJECTED', rejectionReason?: string) =>
    request<LeaveRequest>(`/leave/requests/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, rejectionReason })
    }),

  // Salary Management (Simplified Module)
  getSalaryOverview: (params?: { brandId?: string; period?: string; search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.brandId && params.brandId !== 'all') sp.append('brandId', params.brandId);
    if (params?.period) sp.append('period', params.period);
    if (params?.search) sp.append('search', params.search);
    return request<{
      period: string;
      totalEmployees: number;
      savedEmployeesCount: number;
      summaryFixedSalary: number;
      summaryOtAmount: number;
      summaryIncompleteDeductions: number;
      summaryIncentives: number;
      summaryFinalPayable: number;
      missingPunchWarningsCount: number;
      items: any[];
    }>(`/salary/overview?${sp.toString()}`);
  },

  calculateSingleSalary: (data: { employeeId: string; period: string }) =>
    request<any>('/salary/calculate-single', { method: 'POST', body: JSON.stringify(data) }),

  getSalaryDashboard: (params?: { brandId?: string; period?: string }) => {
    const sp = new URLSearchParams();
    if (params?.brandId && params.brandId !== 'all') sp.append('brandId', params.brandId);
    if (params?.period) sp.append('period', params.period);
    return request<SalaryDashboardData>(`/salary/dashboard?${sp.toString()}`);
  },

  getSalaryConfigs: (params?: { brandId?: string; branchId?: string; departmentId?: string; status?: string; search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.brandId && params.brandId !== 'all') sp.append('brandId', params.brandId);
    if (params?.branchId) sp.append('branchId', params.branchId);
    if (params?.departmentId) sp.append('departmentId', params.departmentId);
    if (params?.status) sp.append('status', params.status);
    if (params?.search) sp.append('search', params.search);
    return request<EmployeeSalaryConfig[]>(`/salary/configs?${sp.toString()}`);
  },

  getEmployeeSalaryConfigHistory: (employeeId: string) =>
    request<{ employee: Employee; activeConfig: EmployeeSalaryConfig | null; history: EmployeeSalaryConfig[] }>(`/salary/configs/${employeeId}`),

  saveSalaryConfig: (data: Partial<EmployeeSalaryConfig> & { employeeId: string; monthlySalary: number; effectiveFrom: string }) =>
    request<EmployeeSalaryConfig>('/salary/configs', { method: 'POST', body: JSON.stringify(data) }),

  getIncentives: (params?: { brandId?: string; payrollMonth?: string; employeeId?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.brandId && params.brandId !== 'all') sp.append('brandId', params.brandId);
    if (params?.payrollMonth) sp.append('payrollMonth', params.payrollMonth);
    if (params?.employeeId) sp.append('employeeId', params.employeeId);
    if (params?.status) sp.append('status', params.status);
    return request<Incentive[]>(`/salary/incentives?${sp.toString()}`);
  },

  createIncentive: (data: { employeeId: string; payrollMonth: string; title: string; amount: number; incentiveType?: string; reason?: string }) =>
    request<Incentive>('/salary/incentives', { method: 'POST', body: JSON.stringify(data) }),

  updateIncentiveStatus: (id: string, status: 'APPROVED' | 'REJECTED') =>
    request<Incentive>(`/salary/incentives/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  getAdjustments: (params?: { brandId?: string; payrollMonth?: string; employeeId?: string }) => {
    const sp = new URLSearchParams();
    if (params?.brandId && params.brandId !== 'all') sp.append('brandId', params.brandId);
    if (params?.payrollMonth) sp.append('payrollMonth', params.payrollMonth);
    if (params?.employeeId) sp.append('employeeId', params.employeeId);
    return request<PayrollAdjustment[]>(`/salary/adjustments?${sp.toString()}`);
  },

  createAdjustment: (data: { employeeId: string; payrollMonth: string; type: string; amount: number; reason: string }) =>
    request<PayrollAdjustment>('/salary/adjustments', { method: 'POST', body: JSON.stringify(data) }),

  // Overtime Management & Instant Salary Calculation
  getOvertimeRecords: (params?: { brandId?: string; payrollMonth?: string; employeeId?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.brandId && params.brandId !== 'all') sp.append('brandId', params.brandId);
    if (params?.payrollMonth) sp.append('payrollMonth', params.payrollMonth);
    if (params?.employeeId) sp.append('employeeId', params.employeeId);
    if (params?.status) sp.append('status', params.status);
    return request<OvertimeRecord[]>(`/salary/overtime?${sp.toString()}`);
  },

  createOvertimeRecord: (data: {
    employeeId: string;
    date: string;
    hours?: number;
    minutes?: number;
    totalMinutes?: number;
    reason?: string;
    customRate?: number;
  }) =>
    request<{ overtimeRecord: OvertimeRecord; additionalSalary: number; updatedPayroll: any }>('/salary/overtime', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateOvertimeStatus: (id: string, status: 'APPROVED' | 'REJECTED') =>
    request<{ updated: OvertimeRecord; updatedPayroll: any }>(`/salary/overtime/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),

  processMonthlySalary: (data: { brandId: string; period: string; reprocess?: boolean }) =>
    request<{ payrollPeriodId: string; period: string; processedCount: number; errors: any[] }>('/salary/process', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getPayrolls: (params?: { brandId?: string; period?: string; status?: string; departmentId?: string; search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.brandId && params.brandId !== 'all') sp.append('brandId', params.brandId);
    if (params?.period) sp.append('period', params.period);
    if (params?.status) sp.append('status', params.status);
    if (params?.departmentId) sp.append('departmentId', params.departmentId);
    if (params?.search) sp.append('search', params.search);
    return request<EmployeePayroll[]>(`/salary/payrolls?${sp.toString()}`);
  },

  getPayrollById: (id: string) => request<EmployeePayroll>(`/salary/payrolls/${id}`),

  updatePayrollReview: (id: string, data: { overrideOtHours?: number; overrideIncompleteHours?: number; remarks?: string; status?: string }) =>
    request<EmployeePayroll>(`/salary/payrolls/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  finalizePayroll: (data: { payrollPeriodId?: string; payrollIds?: string[] }) =>
    request<{ finalizedCount: number; receipts: SalaryReceipt[] }>('/salary/finalize', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getReceipts: (params?: { brandId?: string; period?: string; search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.brandId && params.brandId !== 'all') sp.append('brandId', params.brandId);
    if (params?.period) sp.append('period', params.period);
    if (params?.search) sp.append('search', params.search);
    return request<SalaryReceipt[]>(`/salary/receipts?${sp.toString()}`);
  },

  getReceiptById: (id: string) => request<SalaryReceipt>(`/salary/receipts/${id}`),

  downloadReceiptPdf: async (receiptId: string, receiptNumber?: string) => {
    const token = localStorage.getItem('hrms_token');
    const response = await fetch(`/api/salary/receipts/${receiptId}/pdf`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (!response.ok) throw new Error('Failed to download salary receipt PDF');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Salary_Receipt_${receiptNumber || receiptId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  sendSalaryReceiptMail: (data: { employeePayrollId?: string; employeeId?: string; period?: string }) =>
    request<{ receiptId: string; receiptNumber: string; emailSent: boolean; emailTo: string; emailPreviewUrl?: string; error?: string }>('/salary/send-receipt-mail', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getMyReceipts: () => request<SalaryReceipt[]>('/salary/my-receipts'),

  // Shift Management Module
  getShiftsList: (brandId?: string) => {
    const url = brandId && brandId !== 'all' ? `/shifts?brandId=${brandId}` : '/shifts';
    return request<Shift[]>(url);
  },

  createShiftRecord: (data: {
    brandId?: string;
    name: string;
    code: string;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
    weeklyOff?: string;
    gracePeriodMinutes?: number;
    isDefault?: boolean;
  }) => request<Shift>('/shifts', { method: 'POST', body: JSON.stringify(data) }),

  updateShiftRecord: (id: string, data: Partial<Shift>) =>
    request<Shift>(`/shifts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteShiftRecord: (id: string) =>
    request<{ success: boolean }>(`/shifts/${id}`, { method: 'DELETE' }),

  assignShifts: (data: {
    brandId?: string;
    employeeIds: string[];
    shiftId: string;
    startDate: string;
    endDate?: string;
    isRotational?: boolean;
    rotationFrequency?: 'WEEKLY' | 'MONTHLY';
    rotationShiftIds?: string[];
    notes?: string;
  }) => request<{ assignedCount: number; assignments: ShiftAssignment[] }>('/shifts/assign', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  getShiftAssignments: (brandId?: string, employeeId?: string) => {
    const sp = new URLSearchParams();
    if (brandId && brandId !== 'all') sp.append('brandId', brandId);
    if (employeeId) sp.append('employeeId', employeeId);
    return request<ShiftAssignment[]>(`/shifts/assignments?${sp.toString()}`);
  },

  deleteShiftAssignment: (id: string) =>
    request<{ success: boolean }>(`/shifts/assignments/${id}`, { method: 'DELETE' }),

  getShiftCalendar: (params: { brandId?: string; period: string; search?: string }) => {
    const sp = new URLSearchParams();
    if (params.brandId && params.brandId !== 'all') sp.append('brandId', params.brandId);
    sp.append('period', params.period);
    if (params.search) sp.append('search', params.search);
    return request<ShiftCalendarData>(`/shifts/calendar?${sp.toString()}`);
  },

  getShiftWiseAttendance: (params: { brandId?: string; date: string; search?: string }) => {
    const sp = new URLSearchParams();
    if (params.brandId && params.brandId !== 'all') sp.append('brandId', params.brandId);
    sp.append('date', params.date);
    if (params.search) sp.append('search', params.search);
    return request<ShiftAttendanceData>(`/shifts/attendance?${sp.toString()}`);
  },

  getMyShift: () => request<{
    employee: { id: string; name: string; code: string };
    todayDate: string;
    currentShift: Shift;
    isWeeklyOffToday: boolean;
    isRotational: boolean;
  }>('/shifts/my-shift'),

  // Assets & Documents
  getAssets: (params: { brandId?: string; type?: string; status?: string; employeeId?: string; search?: string }) => {
    const sp = new URLSearchParams();
    if (params.brandId && params.brandId !== 'all') sp.append('brandId', params.brandId);
    if (params.type && params.type !== 'ALL') sp.append('type', params.type);
    if (params.status && params.status !== 'ALL') sp.append('status', params.status);
    if (params.employeeId) sp.append('employeeId', params.employeeId);
    if (params.search) sp.append('search', params.search);
    return request<Asset[]>(`/assets?${sp.toString()}`);
  },

  getAssetById: (id: string) => request<Asset>(`/assets/${id}`),

  createAsset: (data: {
    brandId?: string;
    name: string;
    type: string;
    assetTag: string;
    serialNumber?: string;
    brandModel?: string;
    purchaseDate?: string;
    status?: string;
    notes?: string;
  }) => request<Asset>('/assets', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  updateAsset: (id: string, data: Partial<Asset>) =>
    request<Asset>(`/assets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  deleteAsset: (id: string) =>
    request<{ success: boolean }>(`/assets/${id}`, { method: 'DELETE' }),

  assignAsset: (id: string, data: { employeeId: string; assignedDate?: string; notes?: string }) =>
    request<Asset>(`/assets/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  returnAsset: (id: string, data: { returnedDate?: string; returnNotes?: string; conditionOnReturn?: string }) =>
    request<Asset>(`/assets/${id}/return`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Employee Documents
  getCompanyDocuments: (params: {
    brandId?: string;
    employeeId?: string;
    documentType?: string;
    search?: string;
    includeArchived?: boolean;
  }) => {
    const sp = new URLSearchParams();
    if (params.brandId && params.brandId !== 'all') sp.append('brandId', params.brandId);
    if (params.employeeId) sp.append('employeeId', params.employeeId);
    if (params.documentType && params.documentType !== 'ALL') sp.append('documentType', params.documentType);
    if (params.search) sp.append('search', params.search);
    if (params.includeArchived) sp.append('includeArchived', 'true');
    return request<CompanyDocument[]>(`/documents?${sp.toString()}`);
  },

  createCompanyDocument: (data: {
    brandId?: string;
    employeeId: string;
    title: string;
    documentType: string;
    fileName: string;
    fileUrl: string;
    fileType?: string;
    fileSize?: number;
    issueDate?: string;
    expiryDate?: string;
    remarks?: string;
  }) => request<CompanyDocument>('/documents', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  updateCompanyDocument: (id: string, data: Partial<CompanyDocument>) =>
    request<CompanyDocument>(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  replaceCompanyDocument: (id: string, data: {
    fileName: string;
    fileUrl: string;
    title?: string;
    issueDate?: string;
    expiryDate?: string;
    remarks?: string;
    fileType?: string;
    fileSize?: number;
  }) => request<CompanyDocument>(`/documents/${id}/replace`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  deleteCompanyDocument: (id: string) =>
    request<{ success: boolean }>(`/documents/${id}`, { method: 'DELETE' }),

  // Document Expiry Reminders
  getDocumentExpirySummary: (params: { brandId?: string } = {}) => {
    const sp = new URLSearchParams();
    if (params.brandId && params.brandId !== 'all') sp.append('brandId', params.brandId);
    return request<DocumentExpirySummary>(`/documents/expiry-summary?${sp.toString()}`);
  },

  triggerExpiryReminders: (params: { brandId?: string } = {}) => {
    const sp = new URLSearchParams();
    if (params.brandId && params.brandId !== 'all') sp.append('brandId', params.brandId);
    return request<{ remindersSent: number; details: any[] }>(`/documents/trigger-reminders?${sp.toString()}`, {
      method: 'POST'
    })
  },

  // System Settings Module
  getSystemSettings: () => request<SystemSettingsData>('/settings'),

  updateCompanySettings: (data: Partial<CompanySettings>) =>
    request<CompanySettings>('/settings/company', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  updateAttendanceRules: (data: Partial<AttendanceRules>) =>
    request<AttendanceRules>('/settings/attendance', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  updateLeavePolicies: (data: Partial<LeavePolicies>) =>
    request<LeavePolicies>('/settings/leave', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  updateShiftRules: (data: Partial<ShiftRules>) =>
    request<ShiftRules>('/settings/shift', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  updatePayrollSettings: (data: Partial<PayrollSettings>) =>
    request<PayrollSettings>('/settings/payroll', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  updateApiSettings: (data: Partial<ApiSettings>) =>
    request<ApiSettings>('/settings/api', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  testSettingsConnection: (type: 'BIOMETRIC' | 'SMTP' | 'DEVICE', payload?: any) =>
    request<TestConnectionResult>('/settings/test-connection', {
      method: 'POST',
      body: JSON.stringify({ type, payload })
    }),

  createBrandSetting: (data: Partial<Brand>) =>
    request<Brand>('/settings/brands', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateBrandSetting: (id: string, data: Partial<Brand>) =>
    request<Brand>(`/settings/brands/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  createLeaveTypeSetting: (data: Partial<LeaveType>) =>
    request<LeaveType>('/settings/leave-types', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateLeaveTypeSetting: (id: string, data: Partial<LeaveType>) =>
    request<LeaveType>(`/settings/leave-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  deleteLeaveTypeSetting: (id: string) =>
    request<{ success: boolean }>(`/settings/leave-types/${id}`, {
      method: 'DELETE'
    }),

  createDeviceSetting: (data: Partial<PunchingDeviceSetting>) =>
    request<PunchingDeviceSetting>('/settings/devices', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateDeviceSetting: (id: string, data: Partial<PunchingDeviceSetting>) =>
    request<PunchingDeviceSetting>(`/settings/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  deleteDeviceSetting: (id: string) =>
    request<{ success: boolean }>(`/settings/devices/${id}`, {
      method: 'DELETE'
    })
};
