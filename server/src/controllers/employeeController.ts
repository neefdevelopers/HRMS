import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Role } from '../middleware/rbac.js';
import { systemSettingService } from '../services/systemSettingService.js';
import { notificationService } from '../services/notificationService.js';

export const getEmployees = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const branchId = req.query.branchId as string;
    const departmentId = req.query.departmentId as string;
    const status = req.query.status as string;
    const effectiveCompanyId = req.effectiveCompanyId;

    const where: any = {};

    // Company isolation
    if (effectiveCompanyId) {
      where.companyId = effectiveCompanyId;
    }

    // Brand filtering & isolation
    if (brandId && brandId !== 'all') {
      where.brandId = brandId;
    } else if (req.user?.role === Role.HR && req.user?.brandId) {
      where.brandId = req.user.brandId;
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

    // Company isolation check
    if (req.effectiveCompanyId && employee.companyId && employee.companyId !== req.effectiveCompanyId) {
      return sendError(res, 'Access denied for this employee record.', 403);
    }

    if (req.user?.role === Role.HR && req.user?.brandId && req.user.brandId !== employee.brandId) {
      return sendError(res, 'Access denied for this employee record.', 403);
    }

    return sendSuccess(res, employee);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch employee', 500);
  }
};

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

    // Company isolation check
    if (req.effectiveCompanyId && employee.companyId && employee.companyId !== req.effectiveCompanyId) {
      return sendError(res, 'Access denied for this employee record.', 403);
    }

    if (req.user?.role === Role.HR && req.user?.brandId && req.user.brandId !== employee.brandId) {
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
      employee.gender || 'MALE',
      employee.brandId
    );

    for (const a of currentMonthAttendances) {
      totalWorkingHours += a.workingHours || 0;
      if (a.status === 'PRESENT') presentCount++;
      else if (a.status === 'ABSENT') absentCount++;
      else if (a.status === 'ON_LEAVE') leaveCount++;
      else if (a.status === 'WEEK_OFF') weekOffCount++;
      else if (a.status === 'LATE') {
        presentCount++;
        lateCount++;
      } else if (a.status === 'HALF_DAY') {
        presentCount += 0.5;
      }

      if (a.workingHours > brandGenderDailyHours) {
        totalOvertimeHours += a.workingHours - brandGenderDailyHours;
      } else if (a.workingHours > 0 && a.workingHours < brandGenderDailyHours) {
        totalIncompleteHours += brandGenderDailyHours - a.workingHours;
      }
    }

    const currentYear = new Date().getFullYear();
    const leaveBalances = await prisma.leaveBalance.findMany({
      where: { employeeId: id, year: currentYear },
      include: { leaveType: true }
    });

    const leaveRequests = await prisma.leaveRequest.findMany({
      where: { employeeId: id },
      include: { leaveType: true },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const salaryConfigs = await prisma.employeeSalaryConfig.findMany({
      where: { employeeId: id },
      orderBy: { effectiveFrom: 'desc' },
      take: 5
    });

    const payrolls = await prisma.employeePayroll.findMany({
      where: { employeeId: id },
      include: { payrollPeriod: true, receipt: true },
      orderBy: { createdAt: 'desc' },
      take: 12
    });

    const documents = await prisma.employeeDocument.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' }
    });

    return sendSuccess(res, {
      employee,
      attendanceHistory: attendances,
      punchHistory: punches,
      attendanceSummary: {
        period: currentMonthPrefix,
        presentCount,
        absentCount,
        leaveCount,
        weekOffCount,
        lateCount,
        totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
        totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
        totalIncompleteHours: Math.round(totalIncompleteHours * 100) / 100,
        expectedDailyHours: brandGenderDailyHours
      },
      leaveBalances,
      leaveRequests,
      salaryConfigs,
      payrolls,
      documents
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch complete profile', 500);
  }
};

export const getEmployeeDocuments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: employeeId } = req.params;

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return sendError(res, 'Employee not found', 404);
    }

    if (req.effectiveCompanyId && employee.companyId && employee.companyId !== req.effectiveCompanyId) {
      return sendError(res, 'Access denied for this employee.', 403);
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

    if (req.effectiveCompanyId && employee.companyId && employee.companyId !== req.effectiveCompanyId) {
      return sendError(res, 'Access denied for this employee.', 403);
    }

    if (req.user?.role === Role.HR && req.user?.brandId && req.user.brandId !== employee.brandId) {
      return sendError(res, 'Access denied to upload documents for this employee.', 403);
    }

    const doc = await prisma.employeeDocument.create({
      data: {
        companyId: employee.companyId,
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

    if (req.effectiveCompanyId && doc.companyId && doc.companyId !== req.effectiveCompanyId) {
      return sendError(res, 'Access denied for this document.', 403);
    }

    if (req.user?.role === Role.HR && req.user?.brandId && req.user.brandId !== doc.brandId) {
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

    const brand = await prisma.brand.findUnique({ where: { id: data.brandId } });
    if (!brand) {
      return sendError(res, 'Specified brand not found.', 404);
    }

    const targetCompanyId = req.effectiveCompanyId || brand.companyId;
    if (brand.companyId && targetCompanyId && brand.companyId !== targetCompanyId) {
      return sendError(res, 'Brand does not belong to the active company.', 403);
    }

    if (req.user?.role === Role.HR && req.user?.brandId && req.user.brandId !== data.brandId) {
      return sendError(res, 'Cannot create employees for a brand you do not manage.', 403);
    }

    // Validate unique employeeId scoped to company
    const existingEmp = await prisma.employee.findFirst({
      where: {
        companyId: targetCompanyId,
        employeeId: data.employeeId
      }
    });
    if (existingEmp) {
      return sendError(res, `Employee ID '${data.employeeId}' is already registered in this company.`, 400);
    }

    // Reject assigning branch or department from another brand
    if (data.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: data.branchId } });
      if (!branch || branch.brandId !== data.brandId) {
        return sendError(res, 'Specified branch does not belong to the selected brand.', 400);
      }
    }
    if (data.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: data.departmentId } });
      if (!dept || dept.brandId !== data.brandId) {
        return sendError(res, 'Specified department does not belong to the selected brand.', 400);
      }
    }

    if (data.biometricId) {
      const existingBio = await prisma.employee.findFirst({
        where: {
          companyId: targetCompanyId,
          biometricId: data.biometricId
        }
      });
      if (existingBio) {
        return sendError(res, `Biometric ID '${data.biometricId}' is already assigned in this company.`, 400);
      }
    }

    const employee = await prisma.employee.create({
      data: {
        ...data,
        companyId: targetCompanyId,
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
        companyId: targetCompanyId,
        changesJson: JSON.stringify(data)
      }
    });

    // Notify HR users about new employee creation
    try {
      const hrUserIds = await notificationService.getHrUserIdsForBrand(employee.brandId);
      await notificationService.notifyUsers(hrUserIds, {
        companyId: targetCompanyId,
        title: 'New Employee Registered',
        message: `${employee.firstName} ${employee.lastName} (${employee.employeeId}) has been onboarded into ${employee.brand.name}.`,
        type: 'EMPLOYEE',
        module: 'employee',
        recordId: employee.id,
        actionUrl: `/employees/${employee.id}`,
        eventKeyPrefix: `new-emp-${employee.id}`
      });
    } catch (notifErr: any) {
      console.error('[EmployeeController] Notification error on createEmployee:', notifErr.message);
    }

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

    // Company isolation check
    if (req.effectiveCompanyId && existing.companyId && existing.companyId !== req.effectiveCompanyId) {
      return sendError(res, 'Access denied. Employee belongs to another company.', 403);
    }

    if (req.user?.role === Role.HR && req.user?.brandId && req.user.brandId !== existing.brandId) {
      return sendError(res, 'Access denied to update employee from this brand.', 403);
    }

    const effectiveBrandId = data.brandId || existing.brandId;
    if (data.brandId && data.brandId !== existing.brandId) {
      const newBrand = await prisma.brand.findUnique({ where: { id: data.brandId } });
      if (!newBrand) {
        return sendError(res, 'Target brand not found.', 404);
      }
      const companyId = req.effectiveCompanyId || existing.companyId;
      if (companyId && newBrand.companyId !== companyId) {
        return sendError(res, 'Cannot reassign employee to a brand in another company.', 403);
      }
    }

    if (data.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: data.branchId } });
      if (!branch || branch.brandId !== effectiveBrandId) {
        return sendError(res, 'Specified branch does not belong to the employee brand.', 400);
      }
    }
    if (data.departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: data.departmentId } });
      if (!dept || dept.brandId !== effectiveBrandId) {
        return sendError(res, 'Specified department does not belong to the employee brand.', 400);
      }
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
        companyId: existing.companyId,
        changesJson: JSON.stringify(data)
      }
    });

    // Notify employee of profile updates if updated by someone else
    try {
      const empUserId = await notificationService.getUserIdByEmployeeId(updated.id);
      if (empUserId && empUserId !== req.user?.id) {
        await notificationService.createNotification({
          userId: empUserId,
          title: 'Profile Updated',
          message: 'Your official employee profile details were updated by HR.',
          type: 'EMPLOYEE',
          module: 'employee',
          recordId: updated.id,
          actionUrl: `/employees/${updated.id}`,
          eventKey: `emp-update-${updated.id}-${Date.now()}`
        });
      }
    } catch (notifErr: any) {
      console.error('[EmployeeController] Notification error on updateEmployee:', notifErr.message);
    }

    return sendSuccess(res, updated, 'Employee updated successfully');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, 'Validation error', 400, error.errors);
    }
    return sendError(res, error.message || 'Failed to update employee', 500);
  }
};
