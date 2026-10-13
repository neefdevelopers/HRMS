import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Role } from '../middleware/rbac.js';
import { systemSettingService } from '../services/systemSettingService.js';

export const getEmployees = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const branchId = req.query.branchId as string;
    const departmentId = req.query.departmentId as string;
    const status = req.query.status as string;

    const where: any = {};

    // Brand filtering & isolation
    if (brandId && brandId !== 'all') {
      where.brandId = brandId;
    } else if (req.user?.role !== Role.SUPER_ADMIN && req.user?.role !== Role.GROUP_HR) {
      if (req.user?.brandId) {
        where.brandId = req.user.brandId;
      }
    }

    if (branchId) where.branchId = branchId;
    if (departmentId) where.departmentId = departmentId;
    if (status) where.employeeStatus = status;

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { employeeId: { contains: search } },
        { phone: { contains: search } },
        { biometricId: { contains: search } }
      ];
    }

    const total = await prisma.employee.count({ where });
    const employees = await prisma.employee.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        brand: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, city: true } },
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, title: true } },
        shift: { select: { id: true, name: true, startTime: true, endTime: true, breakMinutes: true, weeklyOff: true } },
        reportingManager: { select: { id: true, firstName: true, lastName: true, employeeId: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return sendSuccess(res, employees, undefined, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch employees', 500);
  }
};

export const getEmployeeById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        brand: true,
        branch: true,
        department: true,
        designation: true,
        shift: true,
        reportingManager: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        },
        subordinates: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        },
        leaveBalances: { include: { leaveType: true } },
        attendances: {
          take: 30,
          orderBy: { date: 'desc' }
        }
      }
    });

    if (!employee) {
      return sendError(res, 'Employee not found', 404);
    }

    // Role check: Employee can only see self; Brand HR can only see same brand
    if (req.user?.role === Role.EMPLOYEE && req.user.employeeId !== id) {
      return sendError(res, 'Access denied. You can only view your own profile.', 403);
    }

    if (
      req.user?.role !== Role.SUPER_ADMIN &&
      req.user?.role !== Role.GROUP_HR &&
      req.user?.brandId !== employee.brandId
    ) {
      return sendError(res, 'Access denied for this employee record.', 403);
    }

    return sendSuccess(res, employee);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch employee', 500);
  }
};

/**
 * GET /api/employees/:id/profile
 * Retrieves full comprehensive employee profile including:
 * - Profile details (personal, contact, official, salary, shift)
 * - Attendance & punch history
 * - Monthly attendance summary
 * - Leave balances & requests
 * - Salary & payslips history
 * - Uploaded documents
 */
export const getEmployeeCompleteProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        brand: true,
        branch: true,
        department: true,
        designation: true,
        shift: true,
        reportingManager: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        },
        shiftAssignments: {
          include: { shift: true },
          orderBy: { startDate: 'desc' }
        }
      }
    });

    if (!employee) {
      return sendError(res, 'Employee not found', 404);
    }

    // Role check: Employee can only see self; Brand HR can only see same brand
    if (req.user?.role === Role.EMPLOYEE && req.user.employeeId !== id) {
      return sendError(res, 'Access denied. You can only view your own profile.', 403);
    }

    if (
      req.user?.role !== Role.SUPER_ADMIN &&
      req.user?.role !== Role.GROUP_HR &&
      req.user?.brandId !== employee.brandId
    ) {
      return sendError(res, 'Access denied for this employee record.', 403);
    }

    // 1. Fetch Attendance History (last 90 days)
    const attendances = await prisma.attendance.findMany({
      where: { employeeId: id },
      include: { shift: true },
      orderBy: { date: 'desc' },
      take: 90
    });

    // 2. Fetch Punch History (last 100 punches)
    const punches = await prisma.punchRecord.findMany({
      where: { employeeId: id },
      include: { device: { select: { deviceName: true, location: true } } },
      orderBy: { punchTime: 'desc' },
      take: 100
    });

    // 3. Compute Monthly Attendance Summary for current/recent period
    const currentMonthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
    const currentMonthAttendances = attendances.filter(a => a.date.startsWith(currentMonthPrefix));

    let totalWorkingHours = 0;
    let totalOvertimeHours = 0;
    let totalIncompleteHours = 0;
    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let weekOffCount = 0;
    let lateCount = 0;

    const brandGenderDailyHours = await systemSettingService.getRequiredDailyHours(
      employee.brandId,
      (employee as any).gender
    );
    const expectedDailyHours = (employee.shift?.fullDayThresholdHours || brandGenderDailyHours);

    for (const a of currentMonthAttendances) {
      totalWorkingHours += a.workingHours || 0;
      if (a.status === 'PRESENT' || a.status === 'LATE' || a.status === 'HALF_DAY') presentCount++;
      if (a.status === 'ABSENT') absentCount++;
      if (a.status === 'ON_LEAVE') leaveCount++;
      if (a.status === 'WEEK_OFF') weekOffCount++;
      if (a.lateMinutes > 0) lateCount++;

      if (a.status !== 'ON_LEAVE' && a.status !== 'WEEK_OFF' && a.status !== 'HOLIDAY') {
        if (a.workingHours > expectedDailyHours) {
          totalOvertimeHours += Number((a.workingHours - expectedDailyHours).toFixed(2));
        } else if (a.workingHours < expectedDailyHours && a.checkIn) {
          totalIncompleteHours += Number((expectedDailyHours - a.workingHours).toFixed(2));
        }
      } else if (a.status === 'WEEK_OFF' && a.workingHours > 0) {
        totalOvertimeHours += a.workingHours;
      }
    }

    const attendanceSummary = {
      month: currentMonthPrefix,
      totalLoggedDays: currentMonthAttendances.length,
      presentDays: presentCount,
      absentDays: absentCount,
      leaveDays: leaveCount,
      weekOffDays: weekOffCount,
      lateDays: lateCount,
      totalWorkingHours: Number(totalWorkingHours.toFixed(2)),
      totalOvertimeHours: Number(totalOvertimeHours.toFixed(2)),
      totalIncompleteHours: Number(totalIncompleteHours.toFixed(2))
    };

    // 4. Fetch Leave Balances & Requests
    const leaveBalances = await prisma.leaveBalance.findMany({
      where: { employeeId: id },
      include: { leaveType: true },
      orderBy: { year: 'desc' }
    });

    const leaveRequests = await prisma.leaveRequest.findMany({
      where: { employeeId: id },
      include: { leaveType: true },
      orderBy: { appliedAt: 'desc' },
      take: 50
    });

    // 5. Fetch Salary & Payroll Records & Payslips
    const payrolls = await prisma.employeePayroll.findMany({
      where: { employeeId: id },
      include: {
        receipt: true,
        payrollPeriod: true
      },
      orderBy: { createdAt: 'desc' },
      take: 24
    });

    // 6. Documents
    const documents = await prisma.employeeDocument.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' }
    });

    return sendSuccess(res, {
      employee,
      attendanceHistory: attendances,
      punchHistory: punches,
      attendanceSummary,
      leaveBalances,
      leaveRequests,
      payrolls,
      documents
    }, 'Employee complete profile retrieved');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch employee complete profile', 500);
  }
};

/**
 * Documents management endpoints
 */
export const getEmployeeDocuments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: employeeId } = req.params;

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return sendError(res, 'Employee not found', 404);
    }

    if (
      req.user?.role !== Role.SUPER_ADMIN &&
      req.user?.role !== Role.GROUP_HR &&
      req.user?.brandId !== employee.brandId &&
      req.user?.employeeId !== employeeId
    ) {
      return sendError(res, 'Access denied to view documents for this employee.', 403);
    }

    const documents = await prisma.employeeDocument.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' }
    });

    return sendSuccess(res, documents);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch documents', 500);
  }
};

export const uploadEmployeeDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: employeeId } = req.params;
    const { title, category, fileName, fileType, fileSize, fileUrl, description } = req.body;

    if (!title || !fileName || !fileUrl) {
      return sendError(res, 'Title, file name, and file content are required', 400);
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return sendError(res, 'Employee not found', 404);
    }

    if (
      req.user?.role !== Role.SUPER_ADMIN &&
      req.user?.role !== Role.GROUP_HR &&
      req.user?.brandId !== employee.brandId
    ) {
      return sendError(res, 'Access denied to upload documents for this employee.', 403);
    }

    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId,
        brandId: employee.brandId,
        title: title.trim(),
        category: category || 'GENERAL',
        fileName: fileName.trim(),
        fileType: fileType || null,
        fileSize: fileSize !== undefined ? parseInt(fileSize, 10) : null,
        fileUrl,
        description: description?.trim() || null,
        uploadedById: req.user?.id || null
      }
    });

    return sendSuccess(res, doc, 'Document uploaded successfully', undefined, 201);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to upload document', 500);
  }
};

export const deleteEmployeeDocument = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: employeeId, docId } = req.params;

    const doc = await prisma.employeeDocument.findFirst({
      where: { id: docId, employeeId }
    });

    if (!doc) {
      return sendError(res, 'Document not found for this employee', 404);
    }

    if (
      req.user?.role !== Role.SUPER_ADMIN &&
      req.user?.role !== Role.GROUP_HR &&
      req.user?.brandId !== doc.brandId
    ) {
      return sendError(res, 'Access denied to delete this document.', 403);
    }

    await prisma.employeeDocument.delete({ where: { id: docId } });
    return sendSuccess(res, null, 'Document deleted successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to delete document', 500);
  }
};

const employeeSchema = z.object({
  employeeId: z.string().min(2),
  brandId: z.string(),
  branchId: z.string(),
  departmentId: z.string(),
  designationId: z.string(),
  shiftId: z.string().optional().nullable(),
  reportingManagerId: z.string().optional().nullable(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  profilePhoto: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  joiningDate: z.string(),
  exitDate: z.string().optional().nullable(),
  employmentType: z.string().default('FULL_TIME'),
  employeeStatus: z.string().default('ACTIVE'),
  biometricId: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).default('MALE').optional(),
  monthlySalary: z.number().nonnegative().optional().default(0)
});

export const createEmployee = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = employeeSchema.parse(req.body);

    // Enforce brand isolation on creation
    if (
      req.user?.role !== Role.SUPER_ADMIN &&
      req.user?.role !== Role.GROUP_HR &&
      req.user?.brandId !== data.brandId
    ) {
      return sendError(res, 'Cannot create employees for a brand you do not manage.', 403);
    }

    // Validate unique employeeId and biometricId
    const existingEmp = await prisma.employee.findUnique({
      where: { employeeId: data.employeeId }
    });
    if (existingEmp) {
      return sendError(res, `Employee ID '${data.employeeId}' is already registered.`, 400);
    }

    if (data.biometricId) {
      const existingBio = await prisma.employee.findUnique({
        where: { biometricId: data.biometricId }
      });
      if (existingBio) {
        return sendError(res, `Biometric ID '${data.biometricId}' is already assigned to another employee.`, 400);
      }
    }

    const employee = await prisma.employee.create({
      data: {
        ...data,
        shiftId: data.shiftId || undefined,
        reportingManagerId: data.reportingManagerId || undefined
      },
      include: {
        brand: true,
        branch: true,
        department: true,
        designation: true
      }
    });

    // Auto-initialize standard leave balances for the year
    const leaveTypes = await prisma.leaveType.findMany({
      where: { brandId: employee.brandId }
    });
    const currentYear = new Date().getFullYear();

    for (const lt of leaveTypes) {
      await prisma.leaveBalance.create({
        data: {
          employeeId: employee.id,
          leaveTypeId: lt.id,
          year: currentYear,
          totalAllocated: lt.daysPerYear,
          used: 0,
          pending: 0,
          remaining: lt.daysPerYear
        }
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'CREATE',
        entityType: 'Employee',
        entityId: employee.id,
        brandId: employee.brandId,
        changesJson: JSON.stringify(data)
      }
    });

    return sendSuccess(res, employee, 'Employee created successfully', undefined, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, 'Validation error', 400, error.errors);
    }
    return sendError(res, error.message || 'Failed to create employee', 500);
  }
};

export const updateEmployee = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = employeeSchema.partial().parse(req.body);

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) {
      return sendError(res, 'Employee not found', 404);
    }

    // Role brand authorization check
    if (
      req.user?.role !== Role.SUPER_ADMIN &&
      req.user?.role !== Role.GROUP_HR &&
      req.user?.brandId !== existing.brandId
    ) {
      return sendError(res, 'Access denied to update employee from this brand.', 403);
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        ...data,
        shiftId: data.shiftId === null ? null : data.shiftId,
        reportingManagerId: data.reportingManagerId === null ? null : data.reportingManagerId
      },
      include: {
        brand: true,
        branch: true,
        department: true,
        designation: true,
        shift: true
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'UPDATE',
        entityType: 'Employee',
        entityId: updated.id,
        brandId: updated.brandId,
        changesJson: JSON.stringify(data)
      }
    });

    return sendSuccess(res, updated, 'Employee updated successfully');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, 'Validation error', 400, error.errors);
    }
    return sendError(res, error.message || 'Failed to update employee', 500);
  }
};
