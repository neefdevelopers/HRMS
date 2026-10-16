import {
  DashboardMetrics, User, Brand, Branch, Department, Designation, Shift, Employee,
  Attendance, LeaveRequest, LeaveType, EmployeeSalaryConfig, Incentive, PayrollAdjustment,
  EmployeePayroll, SalaryReceipt, SalaryDashboardData, OvertimeRecord,
  ShiftAssignment, ShiftCalendarData, ShiftAttendanceData,
  EmployeeCompleteProfile, EmployeeDocument,
  Asset, CompanyDocument, DocumentExpirySummary,
  SystemSettingsData, CompanySettings, AttendanceRules, LeavePolicies, ShiftRules,
  PayrollSettings, PunchingDeviceSetting, ApiSettings, TestConnectionResult,
  ExitRequest, ExitDashboardData, RelievingLetterPreview,
  NotificationItem, NotificationPagination, Company, CompanyMembership, HrUserSummary, Role,
  DailyLeavesData, DailyLeaveRecord, DailyLeaveSummary
} from '../types';

const API_BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('hrms_token');
  const activeCompanyId = localStorage.getItem('hrms_active_company_id');
  const selectedBrandId = localStorage.getItem('hrms_selected_brand');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (activeCompanyId && !headers['X-Company-Id']) {
    headers['X-Company-Id'] = activeCompanyId;
  }
  if (selectedBrandId && !headers['X-Brand-Id']) {
    headers['X-Brand-Id'] = selectedBrandId;
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

async function requestWithMeta<T, M = any>(endpoint: string, options: RequestInit = {}): Promise<{ data: T; meta?: M }> {
  const token = localStorage.getItem('hrms_token');
  const activeCompanyId = localStorage.getItem('hrms_active_company_id');
  const selectedBrandId = localStorage.getItem('hrms_selected_brand');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (activeCompanyId && !headers['X-Company-Id']) {
    headers['X-Company-Id'] = activeCompanyId;
  }
  if (selectedBrandId && !headers['X-Brand-Id']) {
    headers['X-Brand-Id'] = selectedBrandId;
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

  return { data: resJson.data, meta: resJson.meta };
}

export const api = {
  // Auth
  login: (credentials: { email: string; password: string }) =>
    request<{ token: string; user: User; companies?: Company[]; activeCompany?: Company }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),

  getMe: () => request<User & { activeCompany?: Company; companies?: Company[] }>('/auth/me'),

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
  getBrands: (param?: string | { brandId?: string; companyId?: string }) => {
    let url = '/brands';
    if (typeof param === 'string') {
      url = param && param !== 'all' ? `/brands?brandId=${param}` : '/brands';
    } else if (param) {
      const sp = new URLSearchParams();
      if (param.brandId && param.brandId !== 'all') sp.append('brandId', param.brandId);
      if (param.companyId && param.companyId !== 'all') sp.append('companyId', param.companyId);
      const qs = sp.toString();
      url = qs ? `/brands?${qs}` : '/brands';
    }
    return request<Brand[]>(url);
  },

  createBrand: (data: Partial<Brand>) =>
    request<Brand>('/brands', { method: 'POST', body: JSON.stringify(data) }),

  updateBrand: (id: string, data: Partial<Brand>) =>
    request<Brand>(`/brands/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  toggleBrandStatus: (id: string, isActive: boolean) =>
    request<Brand>(`/brands/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),

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
  getEmployees: (params: { page?: number; limit?: number; search?: string; brandId?: string; branchId?: string; departmentId?: string; status?: string; companyId?: string }) => {
    const sp = new URLSearchParams();
    if (params.page) sp.append('page', params.page.toString());
    if (params.limit) sp.append('limit', params.limit.toString());
    if (params.search) sp.append('search', params.search);
    if (params.brandId && params.brandId !== 'all') sp.append('brandId', params.brandId);
    if (params.branchId) sp.append('branchId', params.branchId);
    if (params.departmentId) sp.append('departmentId', params.departmentId);
    if (params.status) sp.append('status', params.status);
    if (params.companyId && params.companyId !== 'all') sp.append('companyId', params.companyId);

    const headers: Record<string, string> = {};
    if (params.companyId) {
      headers['X-Company-Id'] = params.companyId;
    }

    return request<Employee[]>(`/employees?${sp.toString()}`, { headers });
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

  getDailyLeaves: (params: { date?: string; brandId?: string; branchId?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params.date) sp.append('date', params.date);
    if (params.brandId && params.brandId !== 'all') sp.append('brandId', params.brandId);
    if (params.branchId) sp.append('branchId', params.branchId);
    if (params.status) sp.append('status', params.status);
    return request<DailyLeavesData>(`/attendance/daily-leaves?${sp.toString()}`);
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
    const activeCompanyId = localStorage.getItem('hrms_active_company_id');
    const headers: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(activeCompanyId ? { 'X-Company-Id': activeCompanyId } : {})
    };
    const response = await fetch(`/api/salary/receipts/${receiptId}/pdf`, { headers });
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

  previewReceiptPdf: async (receiptId: string) => {
    const token = localStorage.getItem('hrms_token');
    const activeCompanyId = localStorage.getItem('hrms_active_company_id');
    const headers: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(activeCompanyId ? { 'X-Company-Id': activeCompanyId } : {})
    };
    const response = await fetch(`/api/salary/receipts/${receiptId}/pdf`, { headers });
    if (!response.ok) throw new Error('Failed to load salary receipt PDF');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
  },

  prepareSalaryReceipt: (data: { employeePayrollId?: string; employeeId?: string; period?: string }) =>
    request<{
      receiptId: string;
      receiptNumber: string;
      snapshot: any;
      emailTo: string;
      employeeName: string;
      period: string;
      companyName: string;
      netSalary: number;
      amountInWords: string;
    }>('/salary/prepare-receipt', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  sendSalaryReceiptMail: (data: { employeePayrollId?: string; employeeId?: string; period?: string }) =>
    request<{ receiptId: string; receiptNumber: string; emailSent: boolean; emailTo: string; emailPreviewUrl?: string; error?: string }>('/salary/send-receipt-mail', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

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
    }),

  // Exit Management
  getExitDashboard: (params: { brandId?: string; status?: string; search?: string } = {}) => {
    const sp = new URLSearchParams();
    if (params.brandId && params.brandId !== 'all') sp.append('brandId', params.brandId);
    if (params.status && params.status !== 'ALL') sp.append('status', params.status);
    if (params.search && params.search.trim()) sp.append('search', params.search.trim());
    return request<ExitDashboardData>(`/exit/dashboard?${sp.toString()}`);
  },

  submitResignation: (data: {
    employeeId?: string;
    resignationDate?: string;
    reason: string;
    proposedLastWorkingDay?: string;
    employeeRemarks?: string;
  }) => request<ExitRequest>('/exit/submit', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  approveResignation: (id: string, data: { hrRemarks?: string; confirmedLastWorkingDay?: string } = {}) =>
    request<ExitRequest>(`/exit/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  rejectResignation: (id: string, data: { hrRemarks: string }) =>
    request<ExitRequest>(`/exit/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateLastWorkingDay: (id: string, data: { lastWorkingDay: string; hrRemarks?: string }) =>
    request<ExitRequest>(`/exit/${id}/last-working-day`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  withdrawResignation: (id: string, data: { reason: string }) =>
    request<ExitRequest>(`/exit/${id}/withdraw`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateExitChecklist: (id: string, data: {
    handoverCompleted?: boolean;
    tasksHandedOver?: boolean;
    docsHandedOver?: boolean;
    hrClearanceCompleted?: boolean;
    checklistNotes?: string;
  }) => request<ExitRequest>(`/exit/${id}/checklist`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  getExitAssets: (id: string) =>
    request<{
      assignedAssets: Asset[];
      assetHistory: any[];
      assetClearanceCompleted: boolean;
      assetClearanceNotes?: string;
      assetClearedAt?: string;
    }>(`/exit/${id}/assets`),

  clearExitAsset: (id: string, assetId: string, action: 'RETURNED' | 'DAMAGED', notes?: string) =>
    request<{ success: boolean; assetId: string; status: string; remainingCount: number; autoCleared: boolean }>(
      `/exit/${id}/assets/${assetId}/clear`,
      {
        method: 'POST',
        body: JSON.stringify({ action, notes })
      }
    ),

  toggleManualAssetClearance: (id: string, data: { completed: boolean; notes?: string }) =>
    request<ExitRequest>(`/exit/${id}/assets/manual-clear`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  previewRelievingLetter: (id: string) =>
    request<RelievingLetterPreview>(`/exit/${id}/relieving-letter/preview`),

  issueRelievingLetter: (id: string) =>
    request<{ exitRequest: ExitRequest; document: any; pdfBase64: string }>(
      `/exit/${id}/relieving-letter/issue`,
      { method: 'POST' }
    ),

  completeExit: (id: string) =>
    request<ExitRequest>(`/exit/${id}/complete`, { method: 'POST' }),

  // In-App Notifications
  getNotifications: (params: { page?: number; limit?: number; isRead?: boolean; type?: string; companyId?: string; search?: string } = {}) => {
    const sp = new URLSearchParams();
    if (params.page) sp.append('page', params.page.toString());
    if (params.limit) sp.append('limit', params.limit.toString());
    if (params.isRead !== undefined) sp.append('isRead', params.isRead.toString());
    if (params.type && params.type !== 'ALL') sp.append('type', params.type);
    if (params.companyId) sp.append('companyId', params.companyId);
    if (params.search && params.search.trim()) sp.append('search', params.search.trim());
    return requestWithMeta<NotificationItem[], NotificationPagination>(`/notifications?${sp.toString()}`);
  },

  getUnreadNotificationCount: (companyId?: string) => {
    const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    return request<{ unreadCount: number }>(`/notifications/unread-count${qs}`);
  },

  markNotificationAsRead: (id: string) =>
    request<NotificationItem>(`/notifications/${id}/read`, { method: 'PATCH' }),

  markNotificationAsUnread: (id: string) =>
    request<NotificationItem>(`/notifications/${id}/unread`, { method: 'PATCH' }),

  deleteNotification: (id: string) =>
    request<{ id: string }>(`/notifications/${id}`, { method: 'DELETE' }),

  markAllNotificationsAsRead: (companyId?: string) => {
    const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    return request<{ updatedCount: number }>(`/notifications/read-all${qs}`, { method: 'PATCH' });
  },

  clearReadNotifications: (companyId?: string) => {
    const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    return request<{ deletedCount: number }>(`/notifications/clear-read${qs}`, { method: 'DELETE' });
  },

  // Company Management (Platform Super Admin)
  getCompanies: (params?: { search?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.search) sp.append('search', params.search);
    if (params?.status) sp.append('status', params.status);
    const qs = sp.toString() ? `?${sp.toString()}` : '';
    return request<Company[]>(`/companies${qs}`);
  },

  getCompanyById: (id: string) => request<Company>(`/companies/${id}`),

  getCompanyOverview: (id: string) =>
    request<{
      company: Company;
      brands: any[];
      employeeCount: number;
      punchingDeviceCount: number;
      adminMemberships: any[];
      activeExitCount: number;
    }>(`/companies/${id}/overview`),

  createCompany: (data: {
    name: string;
    code: string;
    email: string;
    phone?: string;
    address?: string;
    registrationNumber?: string;
    taxNumber?: string;
    adminEmail?: string;
    adminPassword?: string;
    adminFirstName?: string;
    adminLastName?: string;
  }) =>
    request<Company>('/companies', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateCompany: (id: string, data: Partial<Company>) =>
    request<Company>(`/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  toggleCompanyStatus: (id: string, isActive: boolean) =>
    request<Company>(`/companies/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive })
    }),

  assignCompanyAdmin: (
    id: string,
    data: {
      userId?: string;
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      role?: string;
    }
  ) =>
    request<any>(`/companies/${id}/admins`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // HR Management & Company Assignments (Admin only)
  getHrUsers: () => request<HrUserSummary[]>('/hr-management'),

  createHrUser: (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
    role?: Role;
    companyIds?: string[];
    assignments?: Array<{ companyId: string; role: Role }>;
  }) =>
    request<any>('/hr-management', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateHrUser: (
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      role?: Role;
      isActive?: boolean;
    }
  ) =>
    request<any>(`/hr-management/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  updateHrCompanyAssignments: (
    userId: string,
    payload: string[] | { companyIds?: string[]; assignments?: Array<{ companyId: string; role: Role }> }
  ) => {
    const body = Array.isArray(payload) ? { companyIds: payload } : payload;
    return request<any>(`/hr-management/${userId}/companies`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  getCompanyHrUsers: (companyId: string) =>
    request<any[]>(`/companies/${companyId}/hr-users`),

  assignCompanyHrUser: (companyId: string, userId: string, role?: Role) =>
    request<any>(`/companies/${companyId}/hr-users`, {
      method: 'POST',
      body: JSON.stringify({ userId, role })
    }),

  removeCompanyHrUser: (companyId: string, userId: string) =>
    request<any>(`/companies/${companyId}/hr-users/${userId}`, {
      method: 'DELETE'
    })
};
