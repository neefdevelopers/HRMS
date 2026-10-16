import { Response } from 'express';
import { prisma } from '../config/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Role } from '../middleware/rbac.js';

export const getAttendanceReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const startDate = (req.query.startDate as string) || new Date().toISOString().split('T')[0];
    const endDate = (req.query.endDate as string) || new Date().toISOString().split('T')[0];
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const format = req.query.format as string; // 'json' or 'csv'
    const effectiveCompanyId = req.effectiveCompanyId;

    const where: any = {
      date: { gte: startDate, lte: endDate }
    };

    if (effectiveCompanyId) {
      where.brand = { companyId: effectiveCompanyId };
    } else if (req.user?.role !== Role.ADMIN) {
      const userCompanyIds = (req.user?.memberships || []).filter(m => m.isActive && m.isCompanyActive).map(m => m.companyId);
      where.brand = { companyId: { in: userCompanyIds } };
    }

    if (brandId && brandId !== 'all') {
      where.brandId = brandId;
    } else if (req.user?.role === Role.HR && req.user?.brandId) {
      where.brandId = req.user.brandId;
    }

    const records = await prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            department: { select: { name: true } },
            designation: { select: { title: true } }
          }
        },
        brand: { select: { name: true } },
        branch: { select: { name: true } },
        shift: { select: { name: true } }
      },
      orderBy: [{ date: 'asc' }, { employeeId: 'asc' }]
    });

    if (format === 'csv') {
      const header = 'Date,Employee ID,Employee Name,Brand,Branch,Department,Designation,Shift,Status,Check In,Check Out,Working Hours,Late Minutes\n';
      const rows = records.map((r) => {
        const name = `"${r.employee.firstName} ${r.employee.lastName}"`;
        const inTime = r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : '-';
        const outTime = r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '-';
        return `${r.date},${r.employee.employeeId},${name},"${r.brand.name}","${r.branch.name}","${r.employee.department.name}","${r.employee.designation.title}","${r.shift?.name || '-'}",${r.status},${inTime},${outTime},${r.workingHours},${r.lateMinutes}`;
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=attendance_report_${startDate}_to_${endDate}.csv`);
      return res.status(200).send(header + rows);
    }

    return sendSuccess(res, records);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to generate report', 500);
  }
};

export const getSyncLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await prisma.punchSyncLog.findMany({
      take: 50,
      orderBy: { startTime: 'desc' }
    });
    return sendSuccess(res, logs);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch sync logs', 500);
  }
};
