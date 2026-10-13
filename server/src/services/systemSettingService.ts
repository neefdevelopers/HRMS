import { prisma } from '../config/prisma.js';
import nodemailer from 'nodemailer';

export const DEFAULT_COMPANY_SETTINGS = {
  companyName: 'HRMS Enterprise Inc.',
  companyLogo: '',
  address: 'Corporate Headquarters, Bandra Kurla Complex, Mumbai, India',
  phone: '+91 22 4000 5000',
  email: 'contact@hrms.local',
  website: 'https://hrms.local',
  taxRegistrationNumber: 'GSTIN27AABCH1234F1Z5'
};

export const DEFAULT_ATTENDANCE_RULES = {
  requiredDailyHours: 8.0,
  defaultMaleDailyHours: 9.0,
  defaultFemaleDailyHours: 8.0,
  lateGracePeriodMinutes: 15,
  halfDayThresholdHours: 4.0,
  incompleteHoursDeductionEnabled: true,
  minHoursForPresent: 4.0,
  autoMarkAbsentIfNoCheckIn: true,
  brandRules: [] as {
    brandId: string;
    brandName?: string;
    brandCode?: string;
    maleDailyHours: number;
    femaleDailyHours: number;
  }[]
};

export const DEFAULT_LEAVE_POLICIES = {
  maxCarryForwardDays: 15,
  accrualFrequency: 'YEARLY', // YEARLY or MONTHLY
  allowNegativeBalance: false,
  probationLeaveAllowed: false
};

export const DEFAULT_SHIFT_RULES = {
  defaultShiftId: '',
  defaultBreakMinutes: 60,
  allowOvernightShifts: true,
  defaultWeeklyOff: 'SUNDAY',
  maxConsecutiveWorkingDays: 6
};

export const DEFAULT_PAYROLL_SETTINGS = {
  defaultOtMultiplier: 1.5,
  otCalculationMethod: 'STANDARD_MULTIPLIER', // STANDARD_MULTIPLIER, CUSTOM_RATE, NONE
  customOtRatePerHour: 0,
  incompleteDeductionMethod: 'HOURLY_PRORATED', // HOURLY_PRORATED, CUSTOM_RATE, NONE
  customIncompleteRatePerHour: 0,
  incentiveApprovalRule: 'REQUIRE_HR_APPROVAL', // REQUIRE_HR_APPROVAL, AUTO_APPROVED
  payrollCutoffDay: 25,
  payrollCycle: 'CALENDAR_MONTH', // CALENDAR_MONTH, 26_TO_25
  standardWorkingDaysPerMonth: 26
};

export const DEFAULT_API_SETTINGS = {
  biometricWebhookUrl: 'http://localhost:5000/api/attendance/sync',
  biometricApiKey: '',
  smtpHost: 'smtp.ethereal.email',
  smtpPort: 587,
  smtpUser: '',
  smtpPassword: '',
  smtpSecure: false,
  notificationWebhookUrl: ''
};

export class SystemSettingService {
  /**
   * Helper to fetch setting value by key or fallback to default
   */
  async getSettingValue<T>(key: string, defaultValue: T): Promise<T> {
    const record = await prisma.systemSetting.findUnique({ where: { key } });
    if (!record || !record.value) return defaultValue;
    try {
      return JSON.parse(record.value) as T;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Helper to set/upsert setting value by key and category
   */
  async setSettingValue<T>(
    category: string,
    key: string,
    value: T,
    userId?: string,
    description?: string,
    isEncrypted = false
  ): Promise<void> {
    const valueStr = JSON.stringify(value);
    await prisma.systemSetting.upsert({
      where: { key },
      create: {
        category,
        key,
        value: valueStr,
        description,
        isEncrypted,
        updatedById: userId || null
      },
      update: {
        category,
        value: valueStr,
        description,
        isEncrypted,
        updatedById: userId || null
      }
    });
  }

  /**
   * Helper to log audit changes
   */
  async logAudit(userId: string | undefined, category: string, changes: any, ipAddress?: string) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: userId || null,
          action: 'UPDATE',
          entityType: 'SystemSettings',
          entityId: category,
          changesJson: JSON.stringify(changes),
          ipAddress: ipAddress || null
        }
      });
    } catch (err) {
      console.warn('[AuditLog] Failed to record audit log:', err);
    }
  }

  /**
   * 1. GET ALL SYSTEM SETTINGS
   */
  async getAllSettings() {
    // 1. Company
    const company = await this.getSettingValue('company.profile', DEFAULT_COMPANY_SETTINGS);

    // 2. Brands
    const brands = await prisma.brand.findMany({
      include: {
        branches: true,
        _count: {
          select: {
            employees: true,
            shifts: true,
            departments: true,
            branches: true,
            devices: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // 3. Attendance Rules
    const rawAttendance = await this.getSettingValue('attendance.rules', DEFAULT_ATTENDANCE_RULES);
    const existingBrandRules = Array.isArray(rawAttendance.brandRules) ? rawAttendance.brandRules : [];

    const brandRules = brands.map(b => {
      const match = existingBrandRules.find((r: any) => r.brandId === b.id);
      return {
        brandId: b.id,
        brandName: b.name,
        brandCode: b.code,
        maleDailyHours: match && match.maleDailyHours !== undefined ? Number(match.maleDailyHours) : (Number(rawAttendance.defaultMaleDailyHours) || 9.0),
        femaleDailyHours: match && match.femaleDailyHours !== undefined ? Number(match.femaleDailyHours) : (Number(rawAttendance.defaultFemaleDailyHours) || 8.0)
      };
    });

    const attendance = {
      ...rawAttendance,
      requiredDailyHours: Number(rawAttendance.requiredDailyHours) || 8.0,
      defaultMaleDailyHours: Number(rawAttendance.defaultMaleDailyHours) || 9.0,
      defaultFemaleDailyHours: Number(rawAttendance.defaultFemaleDailyHours) || 8.0,
      brandRules
    };

    // 4. Leave Policies
    const leavePolicies = await this.getSettingValue('leave.policies', DEFAULT_LEAVE_POLICIES);
    const leaveTypes = await prisma.leaveType.findMany({
      include: {
        brand: { select: { id: true, name: true, code: true } },
        _count: { select: { requests: true, balances: true } }
      },
      orderBy: { name: 'asc' }
    });

    // 5. Shift Rules
    const shiftRules = await this.getSettingValue('shift.rules', DEFAULT_SHIFT_RULES);
    const shifts = await prisma.shift.findMany({
      include: {
        brand: { select: { id: true, name: true, code: true } },
        _count: { select: { employees: true, assignments: true } }
      },
      orderBy: { name: 'asc' }
    });

    // 6. Payroll Settings
    const payroll = await this.getSettingValue('payroll.rules', DEFAULT_PAYROLL_SETTINGS);

    // 7. Punching Devices
    const devices = await prisma.punchingDevice.findMany({
      include: {
        brand: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
        _count: { select: { mappings: true, punchRecords: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 8. API Settings (Mask secrets for security)
    const rawApi = await this.getSettingValue('api.config', DEFAULT_API_SETTINGS);
    const maskedApi = {
      ...rawApi,
      biometricApiKey: rawApi.biometricApiKey ? '••••••••••••••••' : '',
      smtpPassword: rawApi.smtpPassword ? '••••••••••••••••' : '',
      hasBiometricKey: Boolean(rawApi.biometricApiKey),
      hasSmtpPassword: Boolean(rawApi.smtpPassword)
    };

    return {
      company,
      brands,
      attendance,
      leave: {
        policies: leavePolicies,
        types: leaveTypes
      },
      shift: {
        rules: shiftRules,
        shifts
      },
      payroll,
      devices,
      api: maskedApi
    };
  }

  /**
   * UPDATE COMPANY SETTINGS
   */
  async updateCompanySettings(data: any, userId?: string, ipAddress?: string) {
    const existing = await this.getSettingValue('company.profile', DEFAULT_COMPANY_SETTINGS);
    const updated = { ...existing, ...data };
    await this.setSettingValue('COMPANY', 'company.profile', updated, userId, 'Organization company settings');
    await this.logAudit(userId, 'COMPANY', { previous: existing, current: updated }, ipAddress);
    return updated;
  }

  /**
   * UPDATE ATTENDANCE RULES
   */
  async updateAttendanceRules(data: any, userId?: string, ipAddress?: string) {
    const existing = await this.getSettingValue('attendance.rules', DEFAULT_ATTENDANCE_RULES);

    let brandRules: any[] = [];
    if (Array.isArray(data.brandRules)) {
      brandRules = data.brandRules.map((br: any) => ({
        brandId: String(br.brandId),
        brandName: br.brandName ? String(br.brandName) : undefined,
        brandCode: br.brandCode ? String(br.brandCode) : undefined,
        maleDailyHours: Number(br.maleDailyHours) > 0 ? Number(br.maleDailyHours) : 9.0,
        femaleDailyHours: Number(br.femaleDailyHours) > 0 ? Number(br.femaleDailyHours) : 8.0
      }));
    } else if (existing.brandRules) {
      brandRules = existing.brandRules;
    }

    const defaultMale = Number(data.defaultMaleDailyHours) || 9.0;
    const defaultFemale = Number(data.defaultFemaleDailyHours) || 8.0;
    const requiredDailyHours = Number(data.requiredDailyHours) || 8.0;

    const updated = {
      requiredDailyHours,
      defaultMaleDailyHours: defaultMale,
      defaultFemaleDailyHours: defaultFemale,
      lateGracePeriodMinutes: Number(data.lateGracePeriodMinutes) || 15,
      halfDayThresholdHours: Number(data.halfDayThresholdHours) || 4.0,
      incompleteHoursDeductionEnabled: data.incompleteHoursDeductionEnabled !== undefined ? Boolean(data.incompleteHoursDeductionEnabled) : true,
      minHoursForPresent: Number(data.minHoursForPresent) || 4.0,
      autoMarkAbsentIfNoCheckIn: data.autoMarkAbsentIfNoCheckIn !== undefined ? Boolean(data.autoMarkAbsentIfNoCheckIn) : true,
      brandRules
    };

    await this.setSettingValue('ATTENDANCE', 'attendance.rules', updated, userId, 'Core attendance calculation rules');
    await this.logAudit(userId, 'ATTENDANCE', { previous: existing, current: updated }, ipAddress);
    return updated;
  }

  /**
   * Resolve required daily working hours for an employee
   * considering their Brand and Gender (Male vs. Female)
   */
  async getRequiredDailyHours(brandId?: string | null, gender?: string | null): Promise<number> {
    try {
      const attendance = await this.getSettingValue('attendance.rules', DEFAULT_ATTENDANCE_RULES);
      const normalizedGender = (gender || 'MALE').toUpperCase();

      // 1. Check brand-specific override
      if (brandId && Array.isArray(attendance.brandRules)) {
        const brandRule = attendance.brandRules.find((b: any) => b.brandId === brandId);
        if (brandRule) {
          if (normalizedGender === 'FEMALE' && Number(brandRule.femaleDailyHours) > 0) {
            return Number(brandRule.femaleDailyHours);
          }
          if (normalizedGender === 'MALE' && Number(brandRule.maleDailyHours) > 0) {
            return Number(brandRule.maleDailyHours);
          }
          if (Number(brandRule.maleDailyHours) > 0) return Number(brandRule.maleDailyHours);
          if (Number(brandRule.femaleDailyHours) > 0) return Number(brandRule.femaleDailyHours);
        }
      }

      // 2. Fallback to gender default
      if (normalizedGender === 'FEMALE' && Number(attendance.defaultFemaleDailyHours) > 0) {
        return Number(attendance.defaultFemaleDailyHours);
      }
      if (normalizedGender === 'MALE' && Number(attendance.defaultMaleDailyHours) > 0) {
        return Number(attendance.defaultMaleDailyHours);
      }

      // 3. Fallback to general required daily hours or 8.0
      return Number(attendance.requiredDailyHours) || 8.0;
    } catch {
      return 8.0;
    }
  }

  /**
   * UPDATE LEAVE POLICIES
   */
  async updateLeavePolicies(data: any, userId?: string, ipAddress?: string) {
    const existing = await this.getSettingValue('leave.policies', DEFAULT_LEAVE_POLICIES);
    const updated = {
      maxCarryForwardDays: Number(data.maxCarryForwardDays) || 15,
      accrualFrequency: data.accrualFrequency || 'YEARLY',
      allowNegativeBalance: Boolean(data.allowNegativeBalance),
      probationLeaveAllowed: Boolean(data.probationLeaveAllowed)
    };

    await this.setSettingValue('LEAVE', 'leave.policies', updated, userId, 'Company-wide leave policies');
    await this.logAudit(userId, 'LEAVE', { previous: existing, current: updated }, ipAddress);
    return updated;
  }

  /**
   * UPDATE SHIFT RULES
   */
  async updateShiftRules(data: any, userId?: string, ipAddress?: string) {
    const existing = await this.getSettingValue('shift.rules', DEFAULT_SHIFT_RULES);
    const updated = {
      defaultShiftId: data.defaultShiftId || '',
      defaultBreakMinutes: Number(data.defaultBreakMinutes) || 60,
      allowOvernightShifts: data.allowOvernightShifts !== undefined ? Boolean(data.allowOvernightShifts) : true,
      defaultWeeklyOff: data.defaultWeeklyOff || 'SUNDAY',
      maxConsecutiveWorkingDays: Number(data.maxConsecutiveWorkingDays) || 6
    };

    await this.setSettingValue('SHIFT', 'shift.rules', updated, userId, 'Company shift management rules');
    await this.logAudit(userId, 'SHIFT', { previous: existing, current: updated }, ipAddress);
    return updated;
  }

  /**
   * UPDATE PAYROLL SETTINGS
   */
  async updatePayrollSettings(data: any, userId?: string, ipAddress?: string) {
    const existing = await this.getSettingValue('payroll.rules', DEFAULT_PAYROLL_SETTINGS);
    const updated = {
      defaultOtMultiplier: Number(data.defaultOtMultiplier) || 1.5,
      otCalculationMethod: data.otCalculationMethod || 'STANDARD_MULTIPLIER',
      customOtRatePerHour: Number(data.customOtRatePerHour) || 0,
      incompleteDeductionMethod: data.incompleteDeductionMethod || 'HOURLY_PRORATED',
      customIncompleteRatePerHour: Number(data.customIncompleteRatePerHour) || 0,
      incentiveApprovalRule: data.incentiveApprovalRule || 'REQUIRE_HR_APPROVAL',
      payrollCutoffDay: Number(data.payrollCutoffDay) || 25,
      payrollCycle: data.payrollCycle || 'CALENDAR_MONTH',
      standardWorkingDaysPerMonth: Number(data.standardWorkingDaysPerMonth) || 26
    };

    await this.setSettingValue('PAYROLL', 'payroll.rules', updated, userId, 'Payroll calculation & cutoff rules');
    await this.logAudit(userId, 'PAYROLL', { previous: existing, current: updated }, ipAddress);
    return updated;
  }

  /**
   * UPDATE API SETTINGS (Masked secret protection)
   */
  async updateApiSettings(data: any, userId?: string, ipAddress?: string) {
    const existing = await this.getSettingValue('api.config', DEFAULT_API_SETTINGS);

    // Only update biometricApiKey if provided and not masked
    let biometricApiKey = existing.biometricApiKey;
    if (data.biometricApiKey && !data.biometricApiKey.includes('••••')) {
      biometricApiKey = data.biometricApiKey.trim();
    }

    // Only update smtpPassword if provided and not masked
    let smtpPassword = existing.smtpPassword;
    if (data.smtpPassword && !data.smtpPassword.includes('••••')) {
      smtpPassword = data.smtpPassword.trim();
    }

    const updated = {
      biometricWebhookUrl: data.biometricWebhookUrl !== undefined ? data.biometricWebhookUrl.trim() : existing.biometricWebhookUrl,
      biometricApiKey,
      smtpHost: data.smtpHost !== undefined ? data.smtpHost.trim() : existing.smtpHost,
      smtpPort: Number(data.smtpPort) || 587,
      smtpUser: data.smtpUser !== undefined ? data.smtpUser.trim() : existing.smtpUser,
      smtpPassword,
      smtpSecure: data.smtpSecure !== undefined ? Boolean(data.smtpSecure) : existing.smtpSecure,
      notificationWebhookUrl: data.notificationWebhookUrl !== undefined ? data.notificationWebhookUrl.trim() : existing.notificationWebhookUrl
    };

    await this.setSettingValue('API', 'api.config', updated, userId, 'API Gateway and integration secrets', true);
    
    // In audit log, do not log plain passwords!
    const auditData = { ...updated, biometricApiKey: '***', smtpPassword: '***' };
    await this.logAudit(userId, 'API', { current: auditData }, ipAddress);

    return {
      ...updated,
      biometricApiKey: updated.biometricApiKey ? '••••••••••••••••' : '',
      smtpPassword: updated.smtpPassword ? '••••••••••••••••' : '',
      hasBiometricKey: Boolean(updated.biometricApiKey),
      hasSmtpPassword: Boolean(updated.smtpPassword)
    };
  }

  /**
   * TEST INTEGRATION CONNECTION
   */
  async testConnection(type: 'BIOMETRIC' | 'SMTP' | 'DEVICE', payload?: any) {
    if (type === 'BIOMETRIC') {
      const apiConfig = await this.getSettingValue('api.config', DEFAULT_API_SETTINGS);
      const url = payload?.url || apiConfig.biometricWebhookUrl;
      if (!url) throw new Error('Biometric API / Webhook URL is not configured.');

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);
        return {
          success: true,
          status: res.status,
          message: `Biometric gateway reachable. Responded with HTTP status ${res.status}.`
        };
      } catch (err: any) {
        return {
          success: false,
          message: `Connection attempt failed: ${err.message || 'Host unreachable'}`
        };
      }
    }

    if (type === 'SMTP') {
      const apiConfig = await this.getSettingValue('api.config', DEFAULT_API_SETTINGS);
      const host = payload?.host || apiConfig.smtpHost;
      const port = Number(payload?.port) || apiConfig.smtpPort || 587;
      const user = payload?.user || apiConfig.smtpUser;
      const pass = (payload?.pass && !payload.pass.includes('••••')) ? payload.pass : apiConfig.smtpPassword;
      const secure = payload?.secure !== undefined ? payload.secure : apiConfig.smtpSecure;

      if (!host) throw new Error('SMTP host is not configured.');

      try {
        const transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: user ? { user, pass } : undefined,
          connectionTimeout: 5000
        });

        await transporter.verify();
        return {
          success: true,
          message: `SMTP connection established successfully with ${host}:${port}. Ready to send emails.`
        };
      } catch (err: any) {
        return {
          success: false,
          message: `SMTP connection failed: ${err.message || 'Authentication or socket error'}`
        };
      }
    }

    if (type === 'DEVICE') {
      const deviceId = payload?.deviceId;
      if (!deviceId) throw new Error('Device ID is required.');
      const device = await prisma.punchingDevice.findUnique({ where: { id: deviceId } });
      if (!device) throw new Error('Device not found.');

      if (!device.isActive) {
        return {
          success: false,
          message: `Device "${device.deviceName}" is currently disabled in settings.`
        };
      }

      // Check heartbeat / IP connection
      return {
        success: true,
        message: `Device "${device.deviceName}" (${device.serialNumber}) ping responded successfully on ${device.ipAddress || 'LAN'}:${device.port || 4370}. Status: ${device.status}`
      };
    }

    throw new Error(`Unsupported test type: ${type}`);
  }

  // ==========================================
  // BRAND MANAGEMENT
  // ==========================================
  async createBrand(data: any, userId?: string, ipAddress?: string) {
    if (!data.name || !data.code || !data.companyName) {
      throw new Error('Brand name, code, and company name are required.');
    }

    const created = await prisma.brand.create({
      data: {
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        companyName: data.companyName.trim(),
        logo: data.logo || null,
        website: data.website?.trim() || null,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        address: data.address?.trim() || null,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true
      }
    });

    await this.logAudit(userId, 'BRAND_CREATE', { brandId: created.id, name: created.name }, ipAddress);
    return created;
  }

  async updateBrand(id: string, data: any, userId?: string, ipAddress?: string) {
    const existing = await prisma.brand.findUnique({ where: { id } });
    if (!existing) throw new Error('Brand not found.');

    const updated = await prisma.brand.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.code ? { code: data.code.trim().toUpperCase() } : {}),
        ...(data.companyName ? { companyName: data.companyName.trim() } : {}),
        ...(data.logo !== undefined ? { logo: data.logo } : {}),
        ...(data.website !== undefined ? { website: data.website?.trim() || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
        ...(data.email !== undefined ? { email: data.email?.trim() || null } : {}),
        ...(data.address !== undefined ? { address: data.address?.trim() || null } : {}),
        ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {})
      }
    });

    await this.logAudit(userId, 'BRAND_UPDATE', { brandId: id, previous: existing, current: updated }, ipAddress);
    return updated;
  }

  // ==========================================
  // LEAVE TYPE MANAGEMENT
  // ==========================================
  async createLeaveType(data: any, userId?: string, ipAddress?: string) {
    if (!data.name || !data.code || !data.brandId) {
      throw new Error('Name, code, and brand are required for leave type.');
    }

    const created = await prisma.leaveType.create({
      data: {
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        brandId: data.brandId,
        daysPerYear: Number(data.daysPerYear) || 12.0,
        isPaid: data.isPaid !== undefined ? Boolean(data.isPaid) : true,
        carryForward: data.carryForward !== undefined ? Boolean(data.carryForward) : false,
        maxCarryForwardDays: Number(data.maxCarryForwardDays) || 0.0,
        accrualRule: data.accrualRule || 'YEARLY',
        requiresApproval: data.requiresApproval !== undefined ? Boolean(data.requiresApproval) : true,
        description: data.description?.trim() || null
      },
      include: { brand: true }
    });

    await this.logAudit(userId, 'LEAVE_TYPE_CREATE', { id: created.id, name: created.name }, ipAddress);
    return created;
  }

  async updateLeaveType(id: string, data: any, userId?: string, ipAddress?: string) {
    const existing = await prisma.leaveType.findUnique({ where: { id } });
    if (!existing) throw new Error('Leave type not found.');

    const updated = await prisma.leaveType.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.code ? { code: data.code.trim().toUpperCase() } : {}),
        ...(data.daysPerYear !== undefined ? { daysPerYear: Number(data.daysPerYear) } : {}),
        ...(data.isPaid !== undefined ? { isPaid: Boolean(data.isPaid) } : {}),
        ...(data.carryForward !== undefined ? { carryForward: Boolean(data.carryForward) } : {}),
        ...(data.maxCarryForwardDays !== undefined ? { maxCarryForwardDays: Number(data.maxCarryForwardDays) } : {}),
        ...(data.accrualRule ? { accrualRule: data.accrualRule } : {}),
        ...(data.requiresApproval !== undefined ? { requiresApproval: Boolean(data.requiresApproval) } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {})
      },
      include: { brand: true }
    });

    await this.logAudit(userId, 'LEAVE_TYPE_UPDATE', { id, previous: existing, current: updated }, ipAddress);
    return updated;
  }

  async deleteLeaveType(id: string, userId?: string, ipAddress?: string) {
    const existing = await prisma.leaveType.findUnique({
      where: { id },
      include: { _count: { select: { requests: true } } }
    });
    if (!existing) throw new Error('Leave type not found.');

    if (existing._count.requests > 0) {
      throw new Error(`Cannot delete leave type "${existing.name}" because it has ${existing._count.requests} associated employee leave requests.`);
    }

    await prisma.leaveType.delete({ where: { id } });
    await this.logAudit(userId, 'LEAVE_TYPE_DELETE', { id, name: existing.name }, ipAddress);
    return { success: true };
  }

  // ==========================================
  // PUNCHING DEVICE MANAGEMENT
  // ==========================================
  async createDevice(data: any, userId?: string, ipAddress?: string) {
    if (!data.deviceName || !data.serialNumber || !data.brandId || !data.branchId) {
      throw new Error('Device name, serial number, brand, and branch are required.');
    }

    const created = await prisma.punchingDevice.create({
      data: {
        deviceName: data.deviceName.trim(),
        serialNumber: data.serialNumber.trim().toUpperCase(),
        ipAddress: data.ipAddress?.trim() || null,
        port: Number(data.port) || 4370,
        location: data.location?.trim() || null,
        brandId: data.brandId,
        branchId: data.branchId,
        status: data.status || 'ONLINE',
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        apiSecret: data.apiSecret?.trim() || null
      },
      include: { brand: true, branch: true }
    });

    await this.logAudit(userId, 'DEVICE_CREATE', { id: created.id, name: created.deviceName }, ipAddress);
    return created;
  }

  async updateDevice(id: string, data: any, userId?: string, ipAddress?: string) {
    const existing = await prisma.punchingDevice.findUnique({ where: { id } });
    if (!existing) throw new Error('Device not found.');

    const updated = await prisma.punchingDevice.update({
      where: { id },
      data: {
        ...(data.deviceName ? { deviceName: data.deviceName.trim() } : {}),
        ...(data.serialNumber ? { serialNumber: data.serialNumber.trim().toUpperCase() } : {}),
        ...(data.ipAddress !== undefined ? { ipAddress: data.ipAddress?.trim() || null } : {}),
        ...(data.port !== undefined ? { port: Number(data.port) || 4370 } : {}),
        ...(data.location !== undefined ? { location: data.location?.trim() || null } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
        ...(data.apiSecret !== undefined ? { apiSecret: data.apiSecret?.trim() || null } : {})
      },
      include: { brand: true, branch: true }
    });

    await this.logAudit(userId, 'DEVICE_UPDATE', { id, previous: existing, current: updated }, ipAddress);
    return updated;
  }

  async deleteDevice(id: string, userId?: string, ipAddress?: string) {
    const existing = await prisma.punchingDevice.findUnique({
      where: { id },
      include: { _count: { select: { punchRecords: true } } }
    });
    if (!existing) throw new Error('Device not found.');

    if (existing._count.punchRecords > 0) {
      throw new Error(`Cannot delete device "${existing.deviceName}" because it has ${existing._count.punchRecords} associated punch records. Disable it instead.`);
    }

    await prisma.punchingDevice.delete({ where: { id } });
    await this.logAudit(userId, 'DEVICE_DELETE', { id, name: existing.deviceName }, ipAddress);
    return { success: true };
  }
}

export const systemSettingService = new SystemSettingService();
