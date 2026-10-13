import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Role } from '../middleware/rbac.js';

export const getLeaveTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const where: any = {};
    if (brandId && brandId !== 'all') {
      where.brandId = brandId;
    }

    const leaveTypes = await prisma.leaveType.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    return sendSuccess(res, leaveTypes);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch leave types', 500);
  }
};

export const getLeaveBalances = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const employeeId = (req.query.employeeId as string) || req.user?.employeeId;
    if (!employeeId) {
      return sendError(res, 'Employee ID is required', 400);
    }

    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const balances = await prisma.leaveBalance.findMany({
      where: { employeeId, year },
      include: { leaveType: true }
    });

    return sendSuccess(res, balances);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch leave balances', 500);
  }
};

export const getLeaveRequests = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const status = req.query.status as string;
    const employeeId = req.query.employeeId as string;

    const where: any = {};

    if (brandId && brandId !== 'all') {
      where.brandId = brandId;
    } else if (req.user?.role !== Role.SUPER_ADMIN && req.user?.role !== Role.GROUP_HR) {
      if (req.user?.brandId) {
        where.brandId = req.user.brandId;
      }
    }

    if (req.user?.role === Role.EMPLOYEE && req.user.employeeId) {
      where.employeeId = req.user.employeeId;
    } else if (employeeId) {
      where.employeeId = employeeId;
    }

    if (status) where.status = status;

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: { select: { name: true } },
            brand: { select: { name: true } }
          }
        },
        leaveType: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return sendSuccess(res, requests);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch leave requests', 500);
  }
};

const applyLeaveSchema = z.object({
  employeeId: z.string().uuid().optional(),
  leaveTypeId: z.string().uuid(),
  startDate: z.string(), // YYYY-MM-DD
  endDate: z.string(),   // YYYY-MM-DD
  isHalfDay: z.boolean().default(false),
  halfDayType: z.string().optional(),
  reason: z.string().min(3)
});

export const applyLeave = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = applyLeaveSchema.parse(req.body);
    let targetEmployeeId = data.employeeId || req.user?.employeeId;

    if (!targetEmployeeId) {
      const brandId = req.effectiveBrandId || req.user?.brandId;
      const defaultEmp = await prisma.employee.findFirst({
        where: {
          employeeStatus: 'ACTIVE',
          ...(brandId && brandId !== 'all' ? { brandId } : {})
        }
      });
      if (defaultEmp) {
        targetEmployeeId = defaultEmp.id;
      }
    }

    if (!targetEmployeeId) {
      return sendError(res, 'Employee ID is required. Please select an employee.', 400);
    }

    const employee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId }
    });

    if (!employee) {
      return sendError(res, 'Employee not found', 404);
    }

    // Check for overlapping leaves
    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: targetEmployeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            startDate: { lte: data.endDate },
            endDate: { gte: data.startDate }
          }
        ]
      }
    });

    if (overlap) {
      return sendError(res, 'A leave request already exists covering the selected dates.', 400);
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: targetEmployeeId,
        leaveTypeId: data.leaveTypeId,
        brandId: employee.brandId,
        startDate: data.startDate,
        endDate: data.endDate,
        isHalfDay: false,
        halfDayType: null,
        reason: data.reason,
        status: 'APPROVED',
        approvedById: req.user?.id,
        reviewedAt: new Date()
      },
      include: {
        leaveType: true,
        employee: true
      }
    });

    // Update attendance directly for all dates in the leave range so employee is recorded ON_LEAVE
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      await prisma.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: dateStr
          }
        },
        update: {
          status: 'ON_LEAVE'
        },
        create: {
          employeeId: employee.id,
          brandId: employee.brandId,
          branchId: employee.branchId,
          shiftId: employee.shiftId,
          date: dateStr,
          status: 'ON_LEAVE',
          workingHours: 0.0
        }
      });
    }

    return sendSuccess(res, leaveRequest, 'Leave recorded successfully', undefined, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, 'Validation error', 400, error.errors);
    }
    return sendError(res, error.message || 'Failed to add leave', 500);
  }
};

export const deleteLeave = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const leave = await prisma.leaveRequest.findUnique({
      where: { id }
    });
    if (!leave) {
      return sendError(res, 'Leave record not found', 404);
    }

    // Clean up any related approval records
    await prisma.approval.deleteMany({
      where: { referenceId: id, type: 'LEAVE' }
    });

    // Clean up ON_LEAVE attendance records for these dates
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      await prisma.attendance.deleteMany({
        where: {
          employeeId: leave.employeeId,
          date: dateStr,
          status: 'ON_LEAVE'
        }
      });
    }

    await prisma.leaveRequest.delete({
      where: { id }
    });

    return sendSuccess(res, null, 'Leave record deleted successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to delete leave', 500);
  }
};

export const reviewLeave = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body; // status: APPROVED or REJECTED

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return sendError(res, 'Invalid status. Must be APPROVED or REJECTED', 400);
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: true }
    });

    if (!leave) {
      return sendError(res, 'Leave request not found', 404);
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        approvedById: req.user?.id,
        reviewedAt: new Date()
      }
    });

    // Update approval queue
    await prisma.approval.updateMany({
      where: { referenceId: id, type: 'LEAVE' },
      data: {
        status,
        approverId: req.user?.employeeId || null
      }
    });

    // If approved, update attendance status for the affected dates so leave is not classified as absent!
    if (status === 'APPROVED') {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        await prisma.attendance.upsert({
          where: {
            employeeId_date: {
              employeeId: leave.employeeId,
              date: dateStr
            }
          },
          update: {
            status: leave.isHalfDay ? 'HALF_DAY' : 'ON_LEAVE'
          },
          create: {
            employeeId: leave.employeeId,
            brandId: leave.brandId,
            branchId: leave.employee.branchId,
            date: dateStr,
            status: leave.isHalfDay ? 'HALF_DAY' : 'ON_LEAVE'
          }
        });
      }
    }

    return sendSuccess(res, updated, `Leave request ${status.toLowerCase()} successfully`);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to review leave request', 500);
  }
};
