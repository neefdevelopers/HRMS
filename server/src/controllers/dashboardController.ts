import { Response } from 'express';
import { prisma } from '../config/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Role } from '../middleware/rbac.js';

export const getDashboardMetrics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const selectedDate = (req.query.date as string) || today;
    const startDate = (req.query.startDate as string) || today;
    const endDate = (req.query.endDate as string) || today;
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const branchId = req.query.branchId as string;
    const departmentId = req.query.departmentId as string;

    // 1. Build Base Filter for Brand / Branch / Department
    const employeeBaseFilter: any = {
      employeeStatus: 'ACTIVE'
    };

    if (brandId && brandId !== 'all') {
      employeeBaseFilter.brandId = brandId;
    } else if (req.user?.role !== Role.SUPER_ADMIN && req.user?.role !== Role.GROUP_HR) {
      if (req.user?.brandId) {
        employeeBaseFilter.brandId = req.user.brandId;
      }
    }

    if (branchId) employeeBaseFilter.branchId = branchId;
    if (departmentId) employeeBaseFilter.departmentId = departmentId;

    // 2. Total Active Employees
    const totalEmployees = await prisma.employee.count({
      where: employeeBaseFilter
    });

    // 3. Brand-wise Employee Distribution
    // Group-level view or single brand view
    const allBrands = await prisma.brand.findMany({
      where: employeeBaseFilter.brandId ? { id: employeeBaseFilter.brandId } : {},
      select: { id: true, name: true, code: true }
    });

    const brandCounts = await Promise.all(
      allBrands.map(async (b) => {
        const count = await prisma.employee.count({
          where: {
            brandId: b.id,
            employeeStatus: 'ACTIVE',
            ...(branchId ? { branchId } : {}),
            ...(departmentId ? { departmentId } : {})
          }
        });
        const percentage = totalEmployees > 0 ? Number(((count / totalEmployees) * 100).toFixed(1)) : 0;
        return {
          brandId: b.id,
          brandName: b.name,
          brandCode: b.code,
          count,
          percentage
        };
      })
    );

    // 4. Attendance Metrics for selectedDate
    const attendanceFilter: any = {
      date: selectedDate,
      employee: employeeBaseFilter
    };

    if (employeeBaseFilter.brandId) {
      attendanceFilter.brandId = employeeBaseFilter.brandId;
    }

    const dailyAttendances = await prisma.attendance.findMany({
      where: attendanceFilter,
      select: {
        id: true,
        status: true,
        lateMinutes: true,
        workingHours: true,
        checkIn: true,
        checkOut: true,
        employeeId: true
      }
    });

    let presentCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;
    let onLeaveCount = 0;

    dailyAttendances.forEach((att) => {
      if (att.status === 'PRESENT') presentCount++;
      else if (att.status === 'LATE') {
        lateCount++;
        presentCount++; // Late employees are also present
      } else if (att.status === 'HALF_DAY') halfDayCount++;
      else if (att.status === 'ON_LEAVE') onLeaveCount++;
    });

    // Also check approved leaves covering selectedDate if not yet reflected in attendance
    const approvedLeavesOnDate = await prisma.leaveRequest.count({
      where: {
        status: 'APPROVED',
        startDate: { lte: selectedDate },
        endDate: { gte: selectedDate },
        employee: employeeBaseFilter
      }
    });

    const finalLeaveCount = Math.max(onLeaveCount, approvedLeavesOnDate);

    // Absent = Active employees minus (Present + Late + On Leave + Half-day)
    const accountedEmployees = presentCount + finalLeaveCount + halfDayCount;
    const absentCount = Math.max(0, totalEmployees - accountedEmployees);

    const presentPercentage = totalEmployees > 0 ? Number(((presentCount / totalEmployees) * 100).toFixed(1)) : 0;
    const absentPercentage = totalEmployees > 0 ? Number(((absentCount / totalEmployees) * 100).toFixed(1)) : 0;

    // 5. New Joiners (within last 30 days or specified date range)
    const newJoiners = await prisma.employee.findMany({
      where: {
        ...employeeBaseFilter,
        joiningDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        joiningDate: true,
        department: { select: { name: true } },
        brand: { select: { name: true } },
        designation: { select: { title: true } }
      },
      orderBy: { joiningDate: 'desc' },
      take: 6
    });

    // 6. Pending Approvals
    // Check pending leave requests & attendance regularizations
    const pendingLeaveApprovals = await prisma.leaveRequest.findMany({
      where: {
        status: 'PENDING',
        employee: employeeBaseFilter
      },
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
        leaveType: { select: { name: true } }
      },
      orderBy: { appliedAt: 'desc' },
      take: 5
    });

    const totalPendingApprovalsCount = await prisma.leaveRequest.count({
      where: {
        status: 'PENDING',
        employee: employeeBaseFilter
      }
    });

    // 8. Payroll Summary (Authorized for Super Admin, Group HR, Brand HR)
    let payrollSummary: any = null;
    const canViewPayroll = [Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR].includes(req.user?.role as any);

    if (canViewPayroll) {
      const currentPeriod = selectedDate.substring(0, 7); // e.g. "2026-10"
      const payrollRecord = await prisma.payrollSummary.findFirst({
        where: {
          period: currentPeriod,
          ...(employeeBaseFilter.brandId ? { brandId: employeeBaseFilter.brandId } : {})
        },
        include: { brand: { select: { name: true } } }
      });

      if (payrollRecord) {
        payrollSummary = {
          configured: true,
          period: payrollRecord.period,
          totalEmployees: payrollRecord.totalEmployees,
          totalGross: payrollRecord.totalGross,
          totalNet: payrollRecord.totalNet,
          status: payrollRecord.status,
          brandName: payrollRecord.brand.name
        };
      } else {
        payrollSummary = {
          configured: false,
          period: currentPeriod,
          message: 'No payroll cycle finalized for the selected month.'
        };
      }
    }

    // 9. Attendance 7-Day Trend Chart
    const trendDates: string[] = [];
    const trendAnchor = new Date(selectedDate);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(trendAnchor);
      d.setDate(d.getDate() - i);
      trendDates.push(d.toISOString().split('T')[0]);
    }

    const attendanceTrend = await Promise.all(
      trendDates.map(async (tDate) => {
        const dayRecords = await prisma.attendance.findMany({
          where: {
            date: tDate,
            employee: employeeBaseFilter
          },
          select: { status: true }
        });

        let pCount = 0;
        let aCount = 0;
        let lCount = 0;
        let lvCount = 0;

        dayRecords.forEach((r) => {
          if (r.status === 'PRESENT') pCount++;
          else if (r.status === 'LATE') {
            lCount++;
            pCount++;
          } else if (r.status === 'ON_LEAVE' || r.status === 'HALF_DAY') lvCount++;
          else if (r.status === 'ABSENT') aCount++;
        });

        const dayName = new Date(tDate).toLocaleDateString('en-US', { weekday: 'short' });
        return {
          date: tDate,
          day: dayName,
          present: pCount,
          absent: aCount > 0 ? aCount : Math.max(0, totalEmployees - pCount - lvCount),
          late: lCount,
          onLeave: lvCount
        };
      })
    );

    return sendSuccess(res, {
      selectedDate,
      kpis: {
        totalEmployees,
        presentToday: {
          count: presentCount,
          percentage: presentPercentage
        },
        absentToday: {
          count: absentCount,
          percentage: absentPercentage
        },
        lateEmployees: {
          count: lateCount
        },
        employeesOnLeave: {
          count: finalLeaveCount
        },
        newJoinersCount: newJoiners.length,
        pendingApprovalsCount: totalPendingApprovalsCount
      },
      brandDistribution: brandCounts,
      attendanceDistribution: {
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        onLeave: finalLeaveCount,
        halfDay: halfDayCount
      },
      attendanceTrend,
      newJoiners,
      pendingApprovals: pendingLeaveApprovals,
      payrollSummary
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch dashboard metrics', 500);
  }
};
