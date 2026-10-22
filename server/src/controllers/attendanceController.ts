import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Role } from '../middleware/rbac.js';
import { PunchSyncService } from '../adapters/punchingAdapter.js';
import { notificationService } from '../services/notificationService.js';

const punchSyncService = new PunchSyncService();

export const getAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const departmentId = req.query.departmentId as string;
    const status = req.query.status as string;
    const employeeId = req.query.employeeId as string;
    const effectiveCompanyId = req.effectiveCompanyId;

    const where: any = {};

    // Date range or single date
    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    } else {
      where.date = date;

      // Automatically sync approved leaves covering this date so they display as ON_LEAVE rather than ordinary absence
      try {
        const approvedLeaves = await prisma.leaveRequest.findMany({
          where: {
            status: 'APPROVED',
            startDate: { lte: date },
            endDate: { gte: date },
            ...(effectiveCompanyId ? { brand: { companyId: effectiveCompanyId } } : {})
          },
          include: { employee: true }
        });

        for (const al of approvedLeaves) {
          await prisma.attendance.upsert({
            where: {
              employeeId_date: {
                employeeId: al.employeeId,
                date
              }
            },
            update: {
              status: al.isHalfDay ? 'HALF_DAY' : 'ON_LEAVE'
            },
            create: {
              companyId: al.companyId || al.employee.companyId,
              employeeId: al.employeeId,
              brandId: al.brandId || al.employee.brandId,
              shiftId: al.employee.shiftId,
              date,
              status: al.isHalfDay ? 'HALF_DAY' : 'ON_LEAVE',
              workingHours: 0.0
            }
          });
        }
      } catch (leaveSyncErr) {
        // Non-blocking log if attendance upsert hits any constraint
        console.error('[AttendanceController] Approved leave sync error:', leaveSyncErr);
      }
    }

    // Company isolation
    if (effectiveCompanyId) {
      where.brand = { companyId: effectiveCompanyId };
    } else if (req.user?.role !== Role.ADMIN) {
      const userCompanyIds = (req.user?.memberships || []).filter(m => m.isActive && m.isCompanyActive).map(m => m.companyId);
      where.brand = { companyId: { in: userCompanyIds } };
    }

    // Brand filtering & role-based scoping
    if (brandId && brandId !== 'all') {
      where.brandId = brandId;
    } else if (req.user?.role === Role.HR && req.user?.brandId) {
      where.brandId = req.user.brandId;
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (status) where.status = status;
    if (departmentId) {
      where.employee = { ...(where.employee || {}), departmentId };
    }

    const total = await prisma.attendance.count({ where });
    const attendances = await prisma.attendance.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            department: { select: { name: true } },
            designation: { select: { title: true } }
          }
        },
        brand: { select: { id: true, name: true, code: true } },
        shift: { select: { id: true, name: true, startTime: true, endTime: true } }
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
    });

    return sendSuccess(res, attendances, undefined, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch attendance', 500);
  }
};

export const syncPunches = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const syncType = (req.body?.syncType as string) || 'MANUAL';
    const fromDateStr = req.body?.fromDate ? new Date(req.body.fromDate) : new Date();
    const toDateStr = req.body?.toDate ? new Date(req.body.toDate) : new Date();

    const result = await punchSyncService.runSync(syncType, fromDateStr, toDateStr);

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'SYNC',
        entityType: 'PunchSyncLog',
        entityId: result.syncLogId,
        brandId: req.user?.brandId,
        companyId: req.effectiveCompanyId || null,
        changesJson: JSON.stringify(result)
      }
    });

    return sendSuccess(res, result, 'Punch synchronization completed successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Synchronization failed', 500);
  }
};

export const manualCorrection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { checkIn, checkOut, status, remarks } = req.body;

    const existing = await prisma.attendance.findUnique({
      where: { id },
      include: { employee: true }
    });

    if (!existing) {
      return sendError(res, 'Attendance record not found', 404);
    }

    // Tenant isolation validation
    if (req.effectiveCompanyId && existing.employee.companyId && existing.employee.companyId !== req.effectiveCompanyId) {
      return sendError(res, 'Access denied. Record belongs to another company.', 403);
    }

    let workingHours = existing.workingHours;
    if (checkIn && checkOut) {
      const inDate = new Date(checkIn);
      const outDate = new Date(checkOut);
      workingHours = Number(((outDate.getTime() - inDate.getTime()) / (1000 * 3600)).toFixed(2));
    }

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        checkIn: checkIn ? new Date(checkIn) : undefined,
        checkOut: checkOut ? new Date(checkOut) : undefined,
        status: status || existing.status,
        workingHours,
        isManualCorrection: true,
        correctedById: req.user?.id,
        remarks
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        action: 'UPDATE',
        entityType: 'Attendance',
        entityId: id,
        brandId: existing.brandId,
        companyId: existing.employee.companyId,
        changesJson: JSON.stringify({ old: existing, updated })
      }
    });

    // Notify authorized HR & Admin of the company
    try {
      const hrUserIds = await notificationService.getHrUserIdsForBrand(existing.brandId);
      await notificationService.notifyUsers(
        hrUserIds.filter((uid) => uid !== req.user?.id),
        {
          companyId: existing.employee.companyId,
          title: 'Attendance Adjusted',
          message: `Attendance record for ${existing.employee.firstName} ${existing.employee.lastName} on ${existing.date} was adjusted (${updated.status}, ${updated.workingHours}h).`,
          type: 'ATTENDANCE',
          module: 'attendance',
          recordId: id,
          actionUrl: '/attendance',
          eventKeyPrefix: `att-adjust-${id}-${Date.now()}`
        }
      );
    } catch (notifErr: any) {
      console.error('[AttendanceController] Notification error on manualCorrection:', notifErr.message);
    }

    return sendSuccess(res, updated, 'Attendance record corrected successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Correction failed', 500);
  }
};

export const getPunches = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const employeeId = req.query.employeeId as string;
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const effectiveCompanyId = req.effectiveCompanyId;

    const where: any = {};

    if (effectiveCompanyId) {
      where.employee = { companyId: effectiveCompanyId };
    }

    if (brandId && brandId !== 'all') {
      where.brandId = brandId;
    }
    if (employeeId) where.employeeId = employeeId;

    const punches = await prisma.punchRecord.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        employee: { select: { firstName: true, lastName: true, employeeId: true } },
        device: { select: { deviceName: true, serialNumber: true } }
      },
      orderBy: { punchTime: 'desc' }
    });

    const total = await prisma.punchRecord.count({ where });

    return sendSuccess(res, punches, undefined, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch punches', 500);
  }
};

/**
 * Get daily employee leave information for a selected date.
 * Read-only endpoint accessible by ADMIN, HR, and ATTENDANCE_VIEWER.
 * Returns only operational leave details necessary for attendance verification.
 */
export const getDailyLeaves = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const status = req.query.status as string; // Optional: ALL, APPROVED, PENDING, REJECTED
    const effectiveCompanyId = req.effectiveCompanyId;

    const baseWhere: any = {
      startDate: { lte: date },
      endDate: { gte: date }
    };

    // Strict Company Isolation
    if (effectiveCompanyId) {
      baseWhere.brand = { companyId: effectiveCompanyId };
    }

    // Brand Scoping
    if (brandId && brandId !== 'all') {
      baseWhere.brandId = brandId;
    } else if (req.user?.role === Role.HR && req.user?.brandId) {
      baseWhere.brandId = req.user.brandId;
    }


    // Filtered where clause for returned list
    const listWhere: any = { ...baseWhere };
    if (status && status !== 'ALL') {
      listWhere.status = status;
    }

    // Fetch matching leave requests with strictly necessary fields
    const leaves = await prisma.leaveRequest.findMany({
      where: listWhere,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        isHalfDay: true,
        halfDayType: true,
        reason: true,
        status: true,
        rejectionReason: true,
        appliedAt: true,
        reviewedAt: true,
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, title: true } }
          }
        },
        brand: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
            isPaid: true
          }
        }
      },
      orderBy: [
        { status: 'asc' }, // APPROVED first, then PENDING, then REJECTED
        { startDate: 'asc' }
      ]
    });

    // Compute summary metrics for all leaves covering this date
    const allOnDate = await prisma.leaveRequest.findMany({
      where: baseWhere,
      select: {
        id: true,
        status: true,
        isHalfDay: true
      }
    });

    const summary = {
      totalApproved: allOnDate.filter((l) => l.status === 'APPROVED').length,
      fullDayApproved: allOnDate.filter((l) => l.status === 'APPROVED' && !l.isHalfDay).length,
      halfDayApproved: allOnDate.filter((l) => l.status === 'APPROVED' && l.isHalfDay).length,
      totalPending: allOnDate.filter((l) => l.status === 'PENDING').length,
      totalRejected: allOnDate.filter((l) => l.status === 'REJECTED').length,
      totalRecords: allOnDate.length
    };

    return sendSuccess(res, {
      date,
      summary,
      leaves
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch daily leaves', 500);
  }
};
