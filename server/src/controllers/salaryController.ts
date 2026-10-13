import { Response } from 'express';
import { prisma } from '../config/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Role } from '../middleware/rbac.js';
import { salaryCalculator } from '../services/salaryCalculator.js';
import { receiptPdfService, ReceiptPdfData } from '../services/receiptPdfService.js';
import { numberToIndianCurrencyWords } from '../utils/numberToWords.js';
import { makeSalaryReceiptAndSendMail } from '../services/salaryReceiptMailer.js';

// Helper to get month bounds (e.g. "2026-10" -> "2026-10-01" to "2026-10-31")
function getMonthBounds(period: string) {
  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const startDate = `${period}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${period}-${lastDay.toString().padStart(2, '0')}`;
  return { startDate, endDate, lastDay };
}

// Helper to get previous date string
function getPreviousDateString(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * SIMPLIFIED SALARY MODULE: Clean Overview for Month
 * Returns all employees with saved or previewed calculations:
 * Final Salary = Fixed Salary + Overtime Amount + Incentives − Incomplete Hours Deduction
 */
export const getSalaryOverview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const period = (req.query.period as string) || new Date().toISOString().slice(0, 7);
    const search = (req.query.search as string) || '';

    const whereBrand: any = {};
    if (brandId && brandId !== 'all') {
      whereBrand.brandId = brandId;
    } else if (req.user?.role !== Role.SUPER_ADMIN && req.user?.role !== Role.GROUP_HR) {
      if (req.user?.brandId) whereBrand.brandId = req.user.brandId;
    }

    if (req.user?.role === Role.EMPLOYEE && req.user.employeeId) {
      whereBrand.id = req.user.employeeId;
    }

    const { startDate, endDate } = getMonthBounds(period);

    const empWhere: any = {
      ...whereBrand,
      employeeStatus: 'ACTIVE'
    };

    if (search) {
      empWhere.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { employeeId: { contains: search } }
      ];
    }

    const employees = await prisma.employee.findMany({
      where: empWhere,
      include: {
        department: { select: { name: true } },
        designation: { select: { title: true } },
        brand: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true } }
      },
      orderBy: { employeeId: 'asc' }
    });

    const payrollPeriods = await prisma.payrollPeriod.findMany({
      where: {
        period,
        ...(whereBrand.brandId ? { brandId: whereBrand.brandId } : {})
      }
    });
    const periodIds = payrollPeriods.map((p) => p.id);

    const savedPayrolls = await prisma.employeePayroll.findMany({
      where: {
        payrollPeriodId: { in: periodIds }
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            department: { select: { name: true } },
            designation: { select: { title: true } },
            branch: { select: { name: true } }
          }
        },
        receipt: {
          select: {
            id: true,
            receiptNumber: true,
            downloadCount: true,
            createdAt: true
          }
        }
      }
    });

    const savedMap = new Map<string, (typeof savedPayrolls)[0]>();
    for (const sp of savedPayrolls) {
      savedMap.set(sp.employeeId, sp);
    }

    // Fetch existing incentives for this month to provide current reasons and editing context
    const periodIncentives = await prisma.incentive.findMany({
      where: {
        payrollMonth: period,
        status: { in: ['APPROVED', 'PENDING'] }
      },
      orderBy: { createdAt: 'desc' }
    });
    const incentiveMap = new Map<string, (typeof periodIncentives)[0]>();
    for (const inc of periodIncentives) {
      if (!incentiveMap.has(inc.employeeId)) {
        incentiveMap.set(inc.employeeId, inc);
      }
    }

    const items: any[] = [];
    let summaryFixedSalary = 0;
    let summaryOtAmount = 0;
    let summaryIncompleteDeductions = 0;
    let summaryIncentives = 0;
    let summaryFinalPayable = 0;
    let missingPunchWarningsCount = 0;

    for (const emp of employees) {
      const saved = savedMap.get(emp.id);
      const empInc = incentiveMap.get(emp.id);
      const currentIncentiveReason = empInc?.reason || empInc?.title || '';

      if (saved) {
        summaryFixedSalary += saved.baseSalary;
        summaryOtAmount += saved.otPayment;
        summaryIncompleteDeductions += saved.incompleteDeductionAmount;
        summaryIncentives += saved.approvedIncentivesAmount;
        summaryFinalPayable += saved.netSalary;
        if (saved.hasMissingPunchFlags) missingPunchWarningsCount++;

        let breakdown = null;
        try {
          if (saved.calculationBreakdownJson) breakdown = JSON.parse(saved.calculationBreakdownJson);
        } catch (_) {}

        items.push({
          id: saved.id,
          employeeId: emp.id,
          employee: {
            ...emp,
            monthlySalary: (emp as any).monthlySalary || saved.baseSalary
          },
          period,
          fixedSalary: saved.baseSalary,
          payableFixedSalary: saved.payableSalary,
          otHours: saved.approvedOtHours,
          otRate: saved.otRate,
          otAmount: saved.otPayment,
          incompleteHours: saved.incompleteHours,
          incompleteDeductionRate: saved.incompleteDeductionRate,
          incompleteDeductionAmount: saved.incompleteDeductionAmount,
          incentiveAmount: saved.approvedIncentivesAmount,
          incentiveReason: currentIncentiveReason,
          finalSalary: saved.netSalary,
          status: saved.status,
          hasMissingPunchFlags: saved.hasMissingPunchFlags,
          receiptId: saved.receipt?.id || null,
          receiptNumber: saved.receipt?.receiptNumber || null,
          isSaved: true,
          calculationBreakdown: breakdown,
          savedAt: saved.updatedAt
        });
      } else {
        try {
          const calc = await salaryCalculator.calculateSalary({
            employeeId: emp.id,
            brandId: emp.brandId,
            payrollMonth: period,
            startDate,
            endDate
          });

          summaryFixedSalary += calc.baseSalary;
          summaryOtAmount += calc.otPayment;
          summaryIncompleteDeductions += calc.incompleteDeductionAmount;
          summaryIncentives += calc.approvedIncentivesAmount;
          summaryFinalPayable += calc.netSalary;
          if (calc.hasMissingPunchFlags) missingPunchWarningsCount++;

          items.push({
            id: `preview-${emp.id}`,
            employeeId: emp.id,
            employee: {
              ...emp,
              monthlySalary: (emp as any).monthlySalary || calc.baseSalary
            },
            period,
            fixedSalary: calc.baseSalary,
            payableFixedSalary: calc.payableSalary,
            otHours: calc.approvedOtHours,
            otRate: calc.otRate,
            otAmount: calc.otPayment,
            incompleteHours: calc.incompleteHours,
            incompleteDeductionRate: calc.incompleteDeductionRate,
            incompleteDeductionAmount: calc.incompleteDeductionAmount,
            incentiveAmount: calc.approvedIncentivesAmount,
            incentiveReason: currentIncentiveReason,
            finalSalary: calc.netSalary,
            status: 'PREVIEW',
            hasMissingPunchFlags: calc.hasMissingPunchFlags,
            missingPunchDates: calc.missingPunchDates,
            isSaved: false,
            calculationBreakdown: calc.calculationBreakdown,
            savedAt: null
          });
        } catch (err: any) {
          items.push({
            id: `error-${emp.id}`,
            employeeId: emp.id,
            employee: emp,
            period,
            fixedSalary: (emp as any).monthlySalary || 0,
            payableFixedSalary: (emp as any).monthlySalary || 0,
            otHours: 0,
            otRate: 0,
            otAmount: 0,
            incompleteHours: 0,
            incompleteDeductionRate: 0,
            incompleteDeductionAmount: 0,
            incentiveAmount: 0,
            incentiveReason: '',
            finalSalary: (emp as any).monthlySalary || 0,
            status: 'ERROR',
            hasMissingPunchFlags: false,
            isSaved: false,
            error: err.message
          });
        }
      }
    }

    return sendSuccess(res, {
      period,
      totalEmployees: employees.length,
      savedEmployeesCount: savedPayrolls.length,
      summaryFixedSalary: Number(summaryFixedSalary.toFixed(2)),
      summaryOtAmount: Number(summaryOtAmount.toFixed(2)),
      summaryIncompleteDeductions: Number(summaryIncompleteDeductions.toFixed(2)),
      summaryIncentives: Number(summaryIncentives.toFixed(2)),
      summaryFinalPayable: Number(summaryFinalPayable.toFixed(2)),
      missingPunchWarningsCount,
      items
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch salary overview', 500);
  }
};

/**
 * Calculate and save single employee's monthly salary
 */
export const calculateSingleSalary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employeeId, period } = req.body;
    if (!employeeId || !period) {
      return sendError(res, 'employeeId and period (YYYY-MM) are required.', 400);
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: { select: { name: true } },
        designation: { select: { title: true } },
        brand: { select: { id: true, name: true, code: true } }
      }
    });
    if (!employee) return sendError(res, 'Employee not found', 404);

    const { startDate, endDate } = getMonthBounds(period);

    let payrollPeriod = await prisma.payrollPeriod.findUnique({
      where: { brandId_period: { brandId: employee.brandId, period } }
    });

    if (!payrollPeriod) {
      payrollPeriod = await prisma.payrollPeriod.create({
        data: {
          brandId: employee.brandId,
          period,
          startDate,
          endDate,
          status: 'DRAFT'
        }
      });
    }

    const calc = await salaryCalculator.calculateSalary({
      employeeId: employee.id,
      brandId: employee.brandId,
      payrollMonth: period,
      startDate,
      endDate
    });

    const dataPayload = {
      payrollPeriodId: payrollPeriod.id,
      employeeId: employee.id,
      brandId: employee.brandId,
      salaryConfigId: calc.salaryConfigId || null,
      currency: calc.currency,
      baseSalary: calc.baseSalary,
      payableSalary: calc.payableSalary,
      standardWorkingDays: calc.standardWorkingDays,
      standardWorkingHoursPerDay: calc.standardWorkingHoursPerDay,
      payableWorkingHours: calc.payableWorkingHours,
      eligibleWorkingHours: calc.eligibleWorkingHours,
      approvedOtHours: calc.approvedOtHours,
      otRate: calc.otRate,
      otPayment: calc.otPayment,
      incompleteHours: calc.incompleteHours,
      incompleteDeductionRate: calc.incompleteDeductionRate,
      incompleteDeductionAmount: calc.incompleteDeductionAmount,
      approvedIncentivesAmount: calc.approvedIncentivesAmount,
      additionalEarnings: calc.additionalEarnings,
      otherDeductions: calc.otherDeductions,
      grossEarnings: calc.grossEarnings,
      totalDeductions: calc.totalDeductions,
      netSalary: calc.netSalary,
      presentDaysCount: calc.presentDaysCount,
      leaveDaysCount: calc.leaveDaysCount,
      absentDaysCount: calc.absentDaysCount,
      hasMissingPunchFlags: calc.hasMissingPunchFlags,
      calculationBreakdownJson: JSON.stringify(calc.calculationBreakdown),
      snapshotConfigJson: JSON.stringify(calc.snapshotConfig),
      status: 'SAVED'
    };

    const savedRecord = await prisma.employeePayroll.upsert({
      where: {
        payrollPeriodId_employeeId: {
          payrollPeriodId: payrollPeriod.id,
          employeeId: employee.id
        }
      },
      update: dataPayload,
      create: dataPayload
    });

    // Automatically make salary receipt and send it to staff as mail
    let receiptResult = null;
    try {
      receiptResult = await makeSalaryReceiptAndSendMail(savedRecord.id);
    } catch (mailErr: any) {
      console.error('[calculateSingleSalary] Receipt mail error:', mailErr);
    }

    const messageText = receiptResult?.emailSent
      ? `Salary calculated, receipt ${receiptResult.receiptNumber} generated and emailed to ${receiptResult.emailTo}`
      : 'Salary calculated and receipt generated successfully';

    return sendSuccess(
      res,
      {
        ...savedRecord,
        employee,
        isSaved: true,
        receipt: receiptResult
      },
      messageText
    );
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to calculate salary', 500);
  }
};

/**
 * 1. SALARY DASHBOARD
 */
export const getSalaryDashboard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const currentPeriod = (req.query.period as string) || new Date().toISOString().slice(0, 7);

    const whereBrand: any = {};
    if (brandId && brandId !== 'all') {
      whereBrand.brandId = brandId;
    } else if (req.user?.role !== Role.SUPER_ADMIN && req.user?.role !== Role.GROUP_HR) {
      if (req.user?.brandId) whereBrand.brandId = req.user.brandId;
    }

    // Total active employees
    const totalEmployees = await prisma.employee.count({
      where: {
        ...whereBrand,
        employeeStatus: 'ACTIVE'
      }
    });

    // Employees with active salary configs
    const configuredEmployeesCount = await prisma.employeeSalaryConfig.count({
      where: {
        ...whereBrand,
        status: 'ACTIVE',
        employee: { employeeStatus: 'ACTIVE' }
      }
    });

    // Payroll records for current period
    const payrolls = await prisma.employeePayroll.findMany({
      where: {
        ...whereBrand,
        payrollPeriod: { period: currentPeriod }
      }
    });

    let totalFixedSalary = 0;
    let totalOvertimePayable = 0;
    let totalApprovedIncentives = 0;
    let totalIncompleteDeductions = 0;
    let totalNetSalary = 0;

    let draftCount = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let finalizedCount = 0;

    for (const p of payrolls) {
      totalFixedSalary += p.payableSalary;
      totalOvertimePayable += p.otPayment;
      totalApprovedIncentives += p.approvedIncentivesAmount;
      totalIncompleteDeductions += p.incompleteDeductionAmount;
      totalNetSalary += p.netSalary;

      if (p.status === 'DRAFT') draftCount++;
      else if (p.status === 'PENDING_REVIEW') pendingCount++;
      else if (p.status === 'APPROVED') approvedCount++;
      else if (p.status === 'FINALIZED') finalizedCount++;
    }

    // If no payrolls yet calculated for this period, show sum of active salary configs as expected base
    if (payrolls.length === 0) {
      const activeConfigs = await prisma.employeeSalaryConfig.findMany({
        where: {
          ...whereBrand,
          status: 'ACTIVE',
          employee: { employeeStatus: 'ACTIVE' }
        }
      });
      totalFixedSalary = activeConfigs.reduce((acc, c) => acc + c.monthlySalary, 0);
    }

    // List of recent payroll periods
    const periods = await prisma.payrollPeriod.findMany({
      where: whereBrand,
      orderBy: { period: 'desc' },
      take: 12,
      include: {
        _count: { select: { payrolls: true } }
      }
    });

    return sendSuccess(res, {
      period: currentPeriod,
      totalEmployees,
      configuredEmployeesCount,
      totalFixedSalary: Number(totalFixedSalary.toFixed(2)),
      totalOvertimePayable: Number(totalOvertimePayable.toFixed(2)),
      totalApprovedIncentives: Number(totalApprovedIncentives.toFixed(2)),
      totalIncompleteDeductions: Number(totalIncompleteDeductions.toFixed(2)),
      totalNetSalary: Number(totalNetSalary.toFixed(2)),
      statusCounts: {
        draft: draftCount,
        pendingReview: pendingCount,
        approved: approvedCount,
        finalized: finalizedCount,
        totalCalculated: payrolls.length
      },
      periods
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch salary dashboard metrics', 500);
  }
};

/**
 * 2. SALARY CONFIGURATIONS
 */
export const getSalaryConfigs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const branchId = req.query.branchId as string;
    const departmentId = req.query.departmentId as string;
    const status = req.query.status as string; // ACTIVE, SUPERSEDED, INACTIVE
    const search = req.query.search as string;

    const where: any = {};
    if (brandId && brandId !== 'all') {
      where.brandId = brandId;
    } else if (req.user?.role !== Role.SUPER_ADMIN && req.user?.role !== Role.GROUP_HR) {
      if (req.user?.brandId) where.brandId = req.user.brandId;
    }

    if (status) {
      where.status = status;
    } else {
      where.status = 'ACTIVE';
    }

    const employeeWhere: any = {};
    if (branchId) employeeWhere.branchId = branchId;
    if (departmentId) employeeWhere.departmentId = departmentId;
    if (search) {
      employeeWhere.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { employeeId: { contains: search } },
        { email: { contains: search } }
      ];
    }

    where.employee = employeeWhere;

    const configs = await prisma.employeeSalaryConfig.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            joiningDate: true,
            employeeStatus: true,
            branch: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, title: true } }
          }
        },
        brand: { select: { id: true, name: true, code: true } }
      },
      orderBy: [{ updatedAt: 'desc' }]
    });

    return sendSuccess(res, configs);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch salary configurations', 500);
  }
};

export const getEmployeeSalaryConfigHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employeeId } = req.params;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        brand: true,
        department: true,
        designation: true,
        branch: true
      }
    });

    if (!employee) {
      return sendError(res, 'Employee not found', 404);
    }

    // Role check
    if (req.user?.role === Role.EMPLOYEE && req.user.employeeId !== employeeId) {
      return sendError(res, 'Access denied', 403);
    }

    const history = await prisma.employeeSalaryConfig.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' }
    });

    return sendSuccess(res, {
      employee,
      activeConfig: history.find((h) => h.status === 'ACTIVE') || null,
      history
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch employee salary history', 500);
  }
};

export const saveSalaryConfig = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      employeeId,
      monthlySalary,
      standardWorkingDays = 26,
      standardWorkingHoursPerDay = 8.0,
      currency = 'INR',
      effectiveFrom,
      effectiveUntil,
      otCalculationMethod = 'STANDARD_HOURLY',
      otRatePerHour = 0,
      incompleteHoursDeductionMethod = 'STANDARD_HOURLY',
      incompleteDeductionRatePerHour = 0
    } = req.body;

    if (!employeeId || monthlySalary === undefined || !effectiveFrom) {
      return sendError(res, 'employeeId, monthlySalary, and effectiveFrom are required.', 400);
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId }
    });

    if (!employee) {
      return sendError(res, 'Employee not found', 404);
    }

    // Multi-brand isolation check
    if (
      req.user?.role !== Role.SUPER_ADMIN &&
      req.user?.role !== Role.GROUP_HR &&
      req.user?.brandId !== employee.brandId
    ) {
      return sendError(res, 'You do not have permission to configure salary for this employee brand.', 403);
    }

    // Maintain historical integrity:
    // When adding a new configuration, close out existing active configs that overlap
    const newConfig = await prisma.$transaction(async (tx) => {
      // Find currently active config
      const existingActive = await tx.employeeSalaryConfig.findFirst({
        where: {
          employeeId,
          status: 'ACTIVE'
        },
        orderBy: { effectiveFrom: 'desc' }
      });

      if (existingActive) {
        // Set previous active config's effectiveUntil to the day before new effectiveFrom
        const prevEffectiveUntil = getPreviousDateString(effectiveFrom);
        await tx.employeeSalaryConfig.update({
          where: { id: existingActive.id },
          data: {
            effectiveUntil: existingActive.effectiveUntil || prevEffectiveUntil,
            status: 'SUPERSEDED'
          }
        });
      }

      // Create new effective-dated config
      const created = await tx.employeeSalaryConfig.create({
        data: {
          employeeId,
          brandId: employee.brandId,
          monthlySalary: parseFloat(monthlySalary),
          standardWorkingDays: parseInt(standardWorkingDays, 10),
          standardWorkingHoursPerDay: parseFloat(standardWorkingHoursPerDay),
          currency,
          effectiveFrom,
          effectiveUntil: effectiveUntil || null,
          otCalculationMethod,
          otRatePerHour: parseFloat(otRatePerHour || 0),
          incompleteHoursDeductionMethod,
          incompleteDeductionRatePerHour: parseFloat(incompleteDeductionRatePerHour || 0),
          status: 'ACTIVE'
        }
      });

      // Audit Log
      await tx.payrollAuditLog.create({
        data: {
          userId: req.user?.id,
          brandId: employee.brandId,
          action: 'CONFIGURE_SALARY',
          employeeId,
          detailsJson: JSON.stringify({
            newConfigId: created.id,
            monthlySalary,
            effectiveFrom,
            effectiveUntil
          })
        }
      });

      return created;
    });

    return sendSuccess(res, newConfig, 'Salary configuration saved successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to save salary configuration', 500);
  }
};

/**
 * 3. INCENTIVES & ADJUSTMENTS
 */
export const getIncentives = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const payrollMonth = req.query.payrollMonth as string;
    const employeeId = req.query.employeeId as string;
    const status = req.query.status as string;

    const where: any = {};
    if (brandId && brandId !== 'all') where.brandId = brandId;
    if (payrollMonth) where.payrollMonth = payrollMonth;
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    const incentives = await prisma.incentive.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return sendSuccess(res, incentives);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch incentives', 500);
  }
};

export const createIncentive = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employeeId, payrollMonth, title, amount, incentiveType = 'FIXED', reason } = req.body;

    if (!employeeId || !payrollMonth || amount === undefined || amount === null) {
      return sendError(res, 'employeeId, payrollMonth, and amount are required.', 400);
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return sendError(res, 'Employee not found', 404);

    const parsedAmount = Math.max(0, parseFloat(amount) || 0);
    const incentiveTitle = title || reason || 'Performance Incentive';

    // Find any existing incentive records for this employee and month
    const existingIncentives = await prisma.incentive.findMany({
      where: { employeeId, payrollMonth }
    });

    let incentive = null;

    if (parsedAmount === 0) {
      // Amount 0 means remove incentive
      if (existingIncentives.length > 0) {
        await prisma.incentive.deleteMany({
          where: { employeeId, payrollMonth }
        });
      }
    } else {
      if (existingIncentives.length > 0) {
        // Edit / Update the existing incentive record (replaces amount instead of incrementing)
        incentive = await prisma.incentive.update({
          where: { id: existingIncentives[0].id },
          data: {
            amount: parsedAmount,
            calculatedAmount: parsedAmount,
            title: incentiveTitle,
            reason: reason || null,
            status: 'APPROVED',
            approvedById: req.user?.id,
            approvedAt: new Date()
          }
        });

        // Clean up any extra duplicates from earlier incremental additions
        if (existingIncentives.length > 1) {
          const extraIds = existingIncentives.slice(1).map((i) => i.id);
          await prisma.incentive.deleteMany({
            where: { id: { in: extraIds } }
          });
        }
      } else {
        // Create initial incentive for this employee and month
        incentive = await prisma.incentive.create({
          data: {
            employeeId,
            brandId: employee.brandId,
            payrollMonth,
            title: incentiveTitle,
            amount: parsedAmount,
            incentiveType,
            calculationBase: 'FIXED_SALARY',
            calculatedAmount: parsedAmount,
            reason: reason || null,
            status: 'APPROVED',
            approvedById: req.user?.id,
            approvedAt: new Date()
          }
        });
      }
    }

    // Automatically recalculate and save employee's salary record for this month
    try {
      const { startDate, endDate } = getMonthBounds(payrollMonth);
      let payrollPeriod = await prisma.payrollPeriod.findUnique({
        where: { brandId_period: { brandId: employee.brandId, period: payrollMonth } }
      });
      if (!payrollPeriod) {
        payrollPeriod = await prisma.payrollPeriod.create({
          data: {
            brandId: employee.brandId,
            period: payrollMonth,
            startDate,
            endDate,
            status: 'DRAFT'
          }
        });
      }

      const calc = await salaryCalculator.calculateSalary({
        employeeId: employee.id,
        brandId: employee.brandId,
        payrollMonth,
        startDate,
        endDate
      });

      await prisma.employeePayroll.upsert({
        where: {
          payrollPeriodId_employeeId: {
            payrollPeriodId: payrollPeriod.id,
            employeeId: employee.id
          }
        },
        update: {
          approvedIncentivesAmount: calc.approvedIncentivesAmount,
          grossEarnings: calc.grossEarnings,
          netSalary: calc.netSalary,
          calculationBreakdownJson: JSON.stringify(calc.calculationBreakdown),
          status: 'SAVED'
        },
        create: {
          payrollPeriodId: payrollPeriod.id,
          employeeId: employee.id,
          brandId: employee.brandId,
          currency: calc.currency,
          baseSalary: calc.baseSalary,
          payableSalary: calc.payableSalary,
          standardWorkingDays: calc.standardWorkingDays,
          standardWorkingHoursPerDay: calc.standardWorkingHoursPerDay,
          payableWorkingHours: calc.payableWorkingHours,
          eligibleWorkingHours: calc.eligibleWorkingHours,
          approvedOtHours: calc.approvedOtHours,
          otRate: calc.otRate,
          otPayment: calc.otPayment,
          incompleteHours: calc.incompleteHours,
          incompleteDeductionRate: calc.incompleteDeductionRate,
          incompleteDeductionAmount: calc.incompleteDeductionAmount,
          approvedIncentivesAmount: calc.approvedIncentivesAmount,
          additionalEarnings: calc.additionalEarnings,
          otherDeductions: calc.otherDeductions,
          grossEarnings: calc.grossEarnings,
          totalDeductions: calc.totalDeductions,
          netSalary: calc.netSalary,
          presentDaysCount: calc.presentDaysCount,
          leaveDaysCount: calc.leaveDaysCount,
          absentDaysCount: calc.absentDaysCount,
          hasMissingPunchFlags: calc.hasMissingPunchFlags,
          calculationBreakdownJson: JSON.stringify(calc.calculationBreakdown),
          snapshotConfigJson: JSON.stringify(calc.snapshotConfig),
          status: 'SAVED'
        }
      });
    } catch (_) {
      // Continue even if immediate payroll sync has an error
    }

    return sendSuccess(res, incentive, 'Incentive added successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to create incentive', 500);
  }
};

export const updateIncentiveStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // APPROVED or REJECTED

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return sendError(res, 'Status must be APPROVED or REJECTED', 400);
    }

    const incentive = await prisma.incentive.update({
      where: { id },
      data: {
        status,
        approvedById: req.user?.id,
        approvedAt: new Date()
      }
    });

    return sendSuccess(res, incentive, `Incentive ${status.toLowerCase()} successfully`);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to update incentive status', 500);
  }
};

export const getAdjustments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const payrollMonth = req.query.payrollMonth as string;
    const employeeId = req.query.employeeId as string;

    const where: any = {};
    if (brandId && brandId !== 'all') where.brandId = brandId;
    if (payrollMonth) where.payrollMonth = payrollMonth;
    if (employeeId) where.employeeId = employeeId;

    const adjustments = await prisma.payrollAdjustment.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return sendSuccess(res, adjustments);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch adjustments', 500);
  }
};

export const createAdjustment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employeeId, payrollMonth, type, amount, reason } = req.body;

    if (!employeeId || !payrollMonth || !type || amount === undefined || !reason) {
      return sendError(res, 'employeeId, payrollMonth, type, amount, and reason are required.', 400);
    }

    if (!['ADDITIONAL_EARNING', 'OTHER_DEDUCTION'].includes(type)) {
      return sendError(res, 'Type must be ADDITIONAL_EARNING or OTHER_DEDUCTION', 400);
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return sendError(res, 'Employee not found', 404);

    const adjustment = await prisma.payrollAdjustment.create({
      data: {
        employeeId,
        brandId: employee.brandId,
        payrollMonth,
        type,
        amount: parseFloat(amount),
        reason,
        status: 'APPROVED',
        approvedById: req.user?.id
      }
    });

    return sendSuccess(res, adjustment, 'Adjustment added successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to create adjustment', 500);
  }
};

/**
 * 4. MONTHLY SALARY PROCESSING & RECALCULATION
 */
export const processMonthlySalary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { brandId, period, reprocess = false } = req.body;

    if (!brandId || !period) {
      return sendError(res, 'brandId and period (YYYY-MM) are required.', 400);
    }

    // Role authorization check
    if (
      req.user?.role !== Role.SUPER_ADMIN &&
      req.user?.role !== Role.GROUP_HR &&
      req.user?.brandId !== brandId
    ) {
      return sendError(res, 'Access denied to process payroll for this brand.', 403);
    }

    const { startDate, endDate } = getMonthBounds(period);

    // 1. Find or create PayrollPeriod
    let payrollPeriod = await prisma.payrollPeriod.findUnique({
      where: {
        brandId_period: { brandId, period }
      }
    });

    if (payrollPeriod && payrollPeriod.status === 'FINALIZED' && !reprocess) {
      return sendError(
        res,
        `Payroll period ${period} is already FINALIZED. Individual corrections must use controlled adjustment or reversal.`,
        400
      );
    }

    if (!payrollPeriod) {
      payrollPeriod = await prisma.payrollPeriod.create({
        data: {
          brandId,
          period,
          startDate,
          endDate,
          status: 'DRAFT'
        }
      });
    }

    // 2. Fetch active employees under this brand
    const employees = await prisma.employee.findMany({
      where: {
        brandId,
        employeeStatus: 'ACTIVE'
      }
    });

    const calculatedPayrolls: any[] = [];
    const errors: Array<{ employeeId: string; employeeName: string; error: string }> = [];

    // 3. Process each employee using the Salary Calculator engine
    for (const emp of employees) {
      try {
        // Calculate
        const calc = await salaryCalculator.calculateSalary({
          employeeId: emp.id,
          brandId,
          payrollMonth: period,
          startDate,
          endDate
        });

        // Check if an existing EmployeePayroll record exists
        const existing = await prisma.employeePayroll.findUnique({
          where: {
            payrollPeriodId_employeeId: {
              payrollPeriodId: payrollPeriod.id,
              employeeId: emp.id
            }
          }
        });

        if (existing && existing.status === 'FINALIZED') {
          // Do not overwrite finalized records
          continue;
        }

        const dataPayload = {
          payrollPeriodId: payrollPeriod.id,
          employeeId: emp.id,
          brandId,
          salaryConfigId: calc.salaryConfigId,
          currency: calc.currency,
          baseSalary: calc.baseSalary,
          payableSalary: calc.payableSalary,
          standardWorkingDays: calc.standardWorkingDays,
          standardWorkingHoursPerDay: calc.standardWorkingHoursPerDay,
          payableWorkingHours: calc.payableWorkingHours,
          eligibleWorkingHours: calc.eligibleWorkingHours,
          approvedOtHours: calc.approvedOtHours,
          otRate: calc.otRate,
          otPayment: calc.otPayment,
          incompleteHours: calc.incompleteHours,
          incompleteDeductionRate: calc.incompleteDeductionRate,
          incompleteDeductionAmount: calc.incompleteDeductionAmount,
          approvedIncentivesAmount: calc.approvedIncentivesAmount,
          additionalEarnings: calc.additionalEarnings,
          otherDeductions: calc.otherDeductions,
          grossEarnings: calc.grossEarnings,
          totalDeductions: calc.totalDeductions,
          netSalary: calc.netSalary,
          presentDaysCount: calc.presentDaysCount,
          leaveDaysCount: calc.leaveDaysCount,
          absentDaysCount: calc.absentDaysCount,
          hasMissingPunchFlags: calc.hasMissingPunchFlags,
          calculationBreakdownJson: JSON.stringify(calc.calculationBreakdown),
          snapshotConfigJson: JSON.stringify(calc.snapshotConfig),
          status: 'PENDING_REVIEW'
        };

        const upserted = await prisma.employeePayroll.upsert({
          where: {
            payrollPeriodId_employeeId: {
              payrollPeriodId: payrollPeriod.id,
              employeeId: emp.id
            }
          },
          update: dataPayload,
          create: dataPayload
        });

        // Automatically make salary receipt and email it to staff
        try {
          await makeSalaryReceiptAndSendMail(upserted.id);
        } catch (mailErr: any) {
          console.error(`[processMonthlySalary] Error making receipt/mail for ${emp.employeeId}:`, mailErr);
        }

        calculatedPayrolls.push(upserted);
      } catch (err: any) {
        errors.push({
          employeeId: emp.employeeId,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          error: err.message
        });
      }
    }

    // Update payroll period status to PENDING_REVIEW if draft
    if (payrollPeriod.status === 'DRAFT') {
      await prisma.payrollPeriod.update({
        where: { id: payrollPeriod.id },
        data: { status: 'PENDING_REVIEW' }
      });
    }

    // Audit Log
    await prisma.payrollAuditLog.create({
      data: {
        userId: req.user?.id,
        brandId,
        action: 'CALCULATE_PAYROLL',
        payrollPeriod: period,
        detailsJson: JSON.stringify({
          processedCount: calculatedPayrolls.length,
          errorCount: errors.length
        })
      }
    });

    return sendSuccess(res, {
      payrollPeriodId: payrollPeriod.id,
      period,
      processedCount: calculatedPayrolls.length,
      errors
    }, `Calculated salary for ${calculatedPayrolls.length} employees`);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to process monthly salary', 500);
  }
};

export const getPayrolls = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const period = (req.query.period as string) || new Date().toISOString().slice(0, 7);
    const status = req.query.status as string;
    const departmentId = req.query.departmentId as string;
    const search = req.query.search as string;

    const where: any = {
      payrollPeriod: { period }
    };

    if (brandId && brandId !== 'all') {
      where.brandId = brandId;
    } else if (req.user?.role !== Role.SUPER_ADMIN && req.user?.role !== Role.GROUP_HR) {
      if (req.user?.brandId) where.brandId = req.user.brandId;
    }

    if (status) where.status = status;

    const empWhere: any = {};
    if (departmentId) empWhere.departmentId = departmentId;
    if (search) {
      empWhere.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { employeeId: { contains: search } }
      ];
    }
    where.employee = empWhere;

    const payrolls = await prisma.employeePayroll.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            department: { select: { name: true } },
            designation: { select: { title: true } },
            branch: { select: { name: true } }
          }
        },
        brand: { select: { id: true, name: true, code: true } },
        receipt: true
      },
      orderBy: [{ employee: { employeeId: 'asc' } }]
    });

    return sendSuccess(res, payrolls);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch payroll records', 500);
  }
};

export const getPayrollById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const payroll = await prisma.employeePayroll.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            department: true,
            designation: true,
            branch: true,
            shift: true
          }
        },
        brand: true,
        payrollPeriod: true,
        receipt: true
      }
    });

    if (!payroll) {
      return sendError(res, 'Payroll record not found', 404);
    }

    // Role check: Employee can only view their own
    if (req.user?.role === Role.EMPLOYEE && req.user.employeeId !== payroll.employeeId) {
      return sendError(res, 'Access denied', 403);
    }

    return sendSuccess(res, payroll);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch payroll record', 500);
  }
};

export const updatePayrollReview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { overrideOtHours, overrideIncompleteHours, remarks, status } = req.body;

    const existing = await prisma.employeePayroll.findUnique({
      where: { id },
      include: { payrollPeriod: true }
    });

    if (!existing) return sendError(res, 'Payroll record not found', 404);
    if (existing.status === 'FINALIZED') {
      return sendError(res, 'Finalized payroll records cannot be edited.', 400);
    }

    // Recalculate using overrides
    const { startDate, endDate } = getMonthBounds(existing.payrollPeriod.period);
    const calc = await salaryCalculator.calculateSalary({
      employeeId: existing.employeeId,
      brandId: existing.brandId,
      payrollMonth: existing.payrollPeriod.period,
      startDate,
      endDate,
      overrideOtHours: overrideOtHours !== undefined ? parseFloat(overrideOtHours) : existing.approvedOtHours,
      overrideIncompleteHours: overrideIncompleteHours !== undefined ? parseFloat(overrideIncompleteHours) : existing.incompleteHours
    });

    const updated = await prisma.employeePayroll.update({
      where: { id },
      data: {
        approvedOtHours: calc.approvedOtHours,
        otPayment: calc.otPayment,
        incompleteHours: calc.incompleteHours,
        incompleteDeductionAmount: calc.incompleteDeductionAmount,
        grossEarnings: calc.grossEarnings,
        totalDeductions: calc.totalDeductions,
        netSalary: calc.netSalary,
        calculationBreakdownJson: JSON.stringify(calc.calculationBreakdown),
        remarks: remarks !== undefined ? remarks : existing.remarks,
        status: status || existing.status,
        approvedById: req.user?.id,
        approvedAt: new Date()
      }
    });

    return sendSuccess(res, updated, 'Payroll record reviewed and updated successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to update payroll review', 500);
  }
};

/**
 * 5. SALARY FINALIZATION & RECEIPT GENERATION
 */
export const finalizePayroll = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { payrollIds, payrollPeriodId } = req.body;

    if (!payrollIds && !payrollPeriodId) {
      return sendError(res, 'payrollIds or payrollPeriodId is required to finalize salary records.', 400);
    }

    const where: any = {};
    if (payrollIds && Array.isArray(payrollIds)) {
      where.id = { in: payrollIds };
    } else if (payrollPeriodId) {
      where.payrollPeriodId = payrollPeriodId;
    }

    where.status = { not: 'FINALIZED' };

    const payrollsToFinalize = await prisma.employeePayroll.findMany({
      where,
      include: {
        employee: {
          include: {
            department: true,
            designation: true,
            branch: true
          }
        },
        brand: true,
        payrollPeriod: true
      }
    });

    if (payrollsToFinalize.length === 0) {
      return sendError(res, 'No eligible payroll records found to finalize.', 400);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Transaction for atomic finalization and receipt creation
    const finalizedReceipts = await prisma.$transaction(async (tx) => {
      const receiptsCreated = [];

      for (let i = 0; i < payrollsToFinalize.length; i++) {
        const item = payrollsToFinalize[i];

        // Format clean receipt number: REC-{BRAND_CODE}-{YYYYMM}-{ID}
        const periodClean = item.payrollPeriod.period.replace('-', '');
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const receiptNumber = `REC-${item.brand.code}-${periodClean}-${item.employee.employeeId.replace(/[^a-zA-Z0-9]/g, '')}`;

        const amountInWords = numberToIndianCurrencyWords(item.netSalary);

        // Snapshot of all data at finalization time
        const snapshot: ReceiptPdfData = {
          receiptNumber,
          issueDate: todayStr,
          paymentDate: todayStr,
          payrollPeriod: item.payrollPeriod.period,
          companyName: item.brand.companyName,
          brandName: item.brand.name,
          brandAddress: item.brand.address,
          brandPhone: item.brand.phone,
          brandEmail: item.brand.email,
          employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
          employeeId: item.employee.employeeId,
          department: item.employee.department.name,
          designation: item.employee.designation.title,
          branch: item.employee.branch.name,
          joiningDate: item.employee.joiningDate,
          currency: item.currency,
          baseSalary: item.baseSalary,
          payableSalary: item.payableSalary,
          isProrated: item.baseSalary !== item.payableSalary,
          approvedOtHours: item.approvedOtHours,
          otRate: item.otRate,
          otPayment: item.otPayment,
          approvedIncentivesAmount: item.approvedIncentivesAmount,
          additionalEarnings: item.additionalEarnings,
          grossEarnings: item.grossEarnings,
          incompleteHours: item.incompleteHours,
          incompleteDeductionRate: item.incompleteDeductionRate,
          incompleteDeductionAmount: item.incompleteDeductionAmount,
          otherDeductions: item.otherDeductions,
          totalDeductions: item.totalDeductions,
          netSalary: item.netSalary,
          amountInWords,
          presentDaysCount: item.presentDaysCount,
          leaveDaysCount: item.leaveDaysCount,
          absentDaysCount: item.absentDaysCount,
          eligibleWorkingHours: item.eligibleWorkingHours,
          payableWorkingHours: item.payableWorkingHours
        };

        // Create or update SalaryReceipt
        const receipt = await tx.salaryReceipt.upsert({
          where: { employeePayrollId: item.id },
          create: {
            employeePayrollId: item.id,
            receiptNumber,
            issueDate: todayStr,
            paymentDate: todayStr,
            netSalary: item.netSalary,
            amountInWords,
            snapshotJson: JSON.stringify(snapshot)
          },
          update: {
            netSalary: item.netSalary,
            amountInWords,
            snapshotJson: JSON.stringify(snapshot)
          }
        });

        // Update EmployeePayroll status to FINALIZED
        await tx.employeePayroll.update({
          where: { id: item.id },
          data: {
            status: 'FINALIZED',
            finalizedById: req.user?.id,
            finalizedAt: new Date()
          }
        });

        receiptsCreated.push(receipt);
      }

      // Check if all payrolls in period are now finalized
      if (payrollPeriodId) {
        const remainingUnfinalized = await tx.employeePayroll.count({
          where: {
            payrollPeriodId,
            status: { not: 'FINALIZED' }
          }
        });

        if (remainingUnfinalized === 0) {
          await tx.payrollPeriod.update({
            where: { id: payrollPeriodId },
            data: {
              status: 'FINALIZED',
              finalizedById: req.user?.id,
              finalizedAt: new Date()
            }
          });
        }
      }

      // Audit Log
      await tx.payrollAuditLog.create({
        data: {
          userId: req.user?.id,
          brandId: payrollsToFinalize[0].brandId,
          action: 'FINALIZE_PAYROLL',
          detailsJson: JSON.stringify({
            finalizedCount: receiptsCreated.length,
            receiptNumbers: receiptsCreated.map((r) => r.receiptNumber)
          })
        }
      });

      return receiptsCreated;
    });

    return sendSuccess(res, {
      finalizedCount: finalizedReceipts.length,
      receipts: finalizedReceipts
    }, `Successfully finalized ${finalizedReceipts.length} salary records and generated receipts`);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to finalize salary records', 500);
  }
};

/**
 * 6. SALARY RECEIPTS & PDF DOWNLOAD
 */
export const getReceipts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const period = req.query.period as string;
    const search = req.query.search as string;

    const where: any = {};
    if (brandId && brandId !== 'all') {
      where.employeePayroll = { brandId };
    } else if (req.user?.role !== Role.SUPER_ADMIN && req.user?.role !== Role.GROUP_HR) {
      if (req.user?.brandId) {
        where.employeePayroll = { brandId: req.user.brandId };
      }
    }

    if (period) {
      where.employeePayroll = {
        ...where.employeePayroll,
        payrollPeriod: { period }
      };
    }

    if (search) {
      where.OR = [
        { receiptNumber: { contains: search } },
        { employeePayroll: { employee: { firstName: { contains: search } } } },
        { employeePayroll: { employee: { lastName: { contains: search } } } },
        { employeePayroll: { employee: { employeeId: { contains: search } } } }
      ];
    }

    const receipts = await prisma.salaryReceipt.findMany({
      where,
      include: {
        employeePayroll: {
          include: {
            employee: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                department: { select: { name: true } },
                designation: { select: { title: true } },
                branch: { select: { name: true } }
              }
            },
            brand: { select: { id: true, name: true, code: true } },
            payrollPeriod: { select: { period: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return sendSuccess(res, receipts);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch salary receipts', 500);
  }
};

export const getReceiptById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const receipt = await prisma.salaryReceipt.findUnique({
      where: { id },
      include: {
        employeePayroll: {
          include: {
            employee: true,
            brand: true,
            payrollPeriod: true
          }
        }
      }
    });

    if (!receipt) return sendError(res, 'Salary receipt not found', 404);

    // Role check: Employee can only view their own receipt
    if (req.user?.role === Role.EMPLOYEE && req.user.employeeId !== receipt.employeePayroll.employeeId) {
      return sendError(res, 'Access denied', 403);
    }

    return sendSuccess(res, receipt);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch receipt', 500);
  }
};

export const downloadReceiptPdf = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const receipt = await prisma.salaryReceipt.findUnique({
      where: { id },
      include: {
        employeePayroll: {
          include: {
            employee: {
              include: {
                department: true,
                designation: true,
                branch: true
              }
            },
            brand: true,
            payrollPeriod: true
          }
        }
      }
    });

    if (!receipt) return sendError(res, 'Salary receipt not found', 404);

    // Role check: Employee can only download their own receipt
    if (req.user?.role === Role.EMPLOYEE && req.user.employeeId !== receipt.employeePayroll.employeeId) {
      return sendError(res, 'Access denied', 403);
    }

    // Parse frozen snapshot if available, or build from records
    let pdfData: ReceiptPdfData;
    if (receipt.snapshotJson) {
      pdfData = JSON.parse(receipt.snapshotJson);
    } else {
      const ep = receipt.employeePayroll;
      pdfData = {
        receiptNumber: receipt.receiptNumber,
        issueDate: receipt.issueDate,
        paymentDate: receipt.paymentDate,
        payrollPeriod: ep.payrollPeriod.period,
        companyName: ep.brand.companyName,
        brandName: ep.brand.name,
        brandAddress: ep.brand.address,
        brandPhone: ep.brand.phone,
        brandEmail: ep.brand.email,
        employeeName: `${ep.employee.firstName} ${ep.employee.lastName}`,
        employeeId: ep.employee.employeeId,
        department: ep.employee.department.name,
        designation: ep.employee.designation.title,
        branch: ep.employee.branch.name,
        joiningDate: ep.employee.joiningDate,
        currency: ep.currency,
        baseSalary: ep.baseSalary,
        payableSalary: ep.payableSalary,
        isProrated: ep.baseSalary !== ep.payableSalary,
        approvedOtHours: ep.approvedOtHours,
        otRate: ep.otRate,
        otPayment: ep.otPayment,
        approvedIncentivesAmount: ep.approvedIncentivesAmount,
        additionalEarnings: ep.additionalEarnings,
        grossEarnings: ep.grossEarnings,
        incompleteHours: ep.incompleteHours,
        incompleteDeductionRate: ep.incompleteDeductionRate,
        incompleteDeductionAmount: ep.incompleteDeductionAmount,
        otherDeductions: ep.otherDeductions,
        totalDeductions: ep.totalDeductions,
        netSalary: ep.netSalary,
        amountInWords: receipt.amountInWords || numberToIndianCurrencyWords(ep.netSalary),
        presentDaysCount: ep.presentDaysCount,
        leaveDaysCount: ep.leaveDaysCount,
        absentDaysCount: ep.absentDaysCount,
        eligibleWorkingHours: ep.eligibleWorkingHours,
        payableWorkingHours: ep.payableWorkingHours
      };
    }

    const pdfBuffer = await receiptPdfService.generateSalaryReceiptPdf(pdfData);

    // Increment download count
    await prisma.salaryReceipt.update({
      where: { id: receipt.id },
      data: { downloadCount: { increment: 1 } }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Salary_Receipt_${receipt.receiptNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to generate receipt PDF', 500);
  }
};

/**
 * 7. EMPLOYEE SELF-SERVICE RECEIPTS
 */
export const getMyReceipts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) {
      return sendError(res, 'User is not linked to an employee profile.', 400);
    }

    const receipts = await prisma.salaryReceipt.findMany({
      where: {
        employeePayroll: {
          employeeId,
          status: 'FINALIZED'
        }
      },
      include: {
        employeePayroll: {
          include: {
            brand: { select: { name: true, code: true } },
            payrollPeriod: { select: { period: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return sendSuccess(res, receipts);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch personal salary receipts', 500);
  }
};

/**
 * 8. OVERTIME RECORDS & AUTOMATIC SALARY CALCULATION
 */
export const getOvertimeRecords = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const brandId = (req.query.brandId as string) || req.effectiveBrandId;
    const payrollMonth = req.query.payrollMonth as string;
    const employeeId = req.query.employeeId as string;
    const status = req.query.status as string;

    const where: any = {};
    if (brandId && brandId !== 'all') where.brandId = brandId;
    if (payrollMonth) where.payrollMonth = payrollMonth;
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    if (req.user?.role === Role.EMPLOYEE && req.user.employeeId) {
      where.employeeId = req.user.employeeId;
    }

    const records = await prisma.overtimeRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } }
          }
        }
      },
      orderBy: { date: 'desc' }
    });

    return sendSuccess(res, records);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch overtime records', 500);
  }
};

export const createOvertimeRecord = async (req: AuthenticatedRequest, res: Response) => {
  try {
    let { employeeId, date, hours, minutes, totalMinutes, reason, customRate } = req.body;

    if (req.user?.role === Role.EMPLOYEE && req.user.employeeId) {
      employeeId = req.user.employeeId;
    }

    if (!employeeId || !date) {
      return sendError(res, 'employeeId and date (YYYY-MM-DD) are required.', 400);
    }

    let parsedHours = 0;
    if (totalMinutes !== undefined && totalMinutes !== null && totalMinutes !== '') {
      parsedHours = parseFloat(totalMinutes) / 60;
    } else {
      const h = hours !== undefined && hours !== null && hours !== '' ? parseFloat(hours) : 0;
      const m = minutes !== undefined && minutes !== null && minutes !== '' ? parseFloat(minutes) : 0;
      parsedHours = (isNaN(h) ? 0 : h) + ((isNaN(m) ? 0 : m) / 60);
    }

    if (isNaN(parsedHours) || parsedHours <= 0) {
      return sendError(res, 'Overtime duration must be greater than 0 minutes.', 400);
    }
    parsedHours = Number(parsedHours.toFixed(4));

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { brand: true }
    });
    if (!employee) return sendError(res, 'Employee not found', 404);

    const payrollMonth = date.slice(0, 7);
    const { startDate, endDate } = getMonthBounds(payrollMonth);

    // Get employee's salary config to calculate rate
    const config = await salaryCalculator.getEffectiveSalaryConfig(employeeId, startDate, endDate);
    let otRate = 0;
    if (customRate && parseFloat(customRate) > 0) {
      otRate = parseFloat(customRate);
    } else if (config) {
      const payableHours = (config.standardWorkingDays || 26) * (config.standardWorkingHoursPerDay || 8);
      const baseHourly = payableHours > 0 ? config.monthlySalary / payableHours : 0;
      if (config.otCalculationMethod === 'CUSTOM_RATE' && config.otRatePerHour > 0) {
        otRate = config.otRatePerHour;
      } else if (config.otCalculationMethod === '1.5X_HOURLY') {
        otRate = Number((baseHourly * 1.5).toFixed(2));
      } else if (config.otCalculationMethod === '2.0X_HOURLY') {
        otRate = Number((baseHourly * 2.0).toFixed(2));
      } else if (config.otCalculationMethod === 'STANDARD_HOURLY') {
        otRate = Number(baseHourly.toFixed(2));
      } else {
        otRate = 0;
      }
    }

    const otAmount = Number((parsedHours * otRate).toFixed(2));
    const isHrOrAdmin = [Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR].includes(req.user?.role as any);

    const otRecord = await prisma.overtimeRecord.create({
      data: {
        employeeId,
        brandId: employee.brandId,
        date,
        payrollMonth,
        hours: parsedHours,
        otRate,
        otAmount,
        reason: reason || null,
        status: isHrOrAdmin ? 'APPROVED' : 'PENDING',
        approvedById: isHrOrAdmin ? req.user?.id : null,
        approvedAt: isHrOrAdmin ? new Date() : null
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // If APPROVED, auto-recalculate employee's monthly payroll if period exists
    let updatedPayroll = null;
    if (otRecord.status === 'APPROVED') {
      const payrollPeriod = await prisma.payrollPeriod.findUnique({
        where: { brandId_period: { brandId: employee.brandId, period: payrollMonth } }
      });

      if (payrollPeriod && payrollPeriod.status !== 'FINALIZED') {
        const calc = await salaryCalculator.calculateSalary({
          employeeId,
          brandId: employee.brandId,
          payrollMonth,
          startDate,
          endDate
        });

        updatedPayroll = await prisma.employeePayroll.upsert({
          where: {
            payrollPeriodId_employeeId: {
              payrollPeriodId: payrollPeriod.id,
              employeeId
            }
          },
          update: {
            approvedOtHours: calc.approvedOtHours,
            otRate: calc.otRate,
            otPayment: calc.otPayment,
            grossEarnings: calc.grossEarnings,
            netSalary: calc.netSalary,
            calculationBreakdownJson: JSON.stringify(calc.calculationBreakdown),
            snapshotConfigJson: JSON.stringify(calc.snapshotConfig)
          },
          create: {
            payrollPeriodId: payrollPeriod.id,
            employeeId,
            brandId: employee.brandId,
            salaryConfigId: calc.salaryConfigId,
            currency: calc.currency,
            baseSalary: calc.baseSalary,
            payableSalary: calc.payableSalary,
            standardWorkingDays: calc.standardWorkingDays,
            standardWorkingHoursPerDay: calc.standardWorkingHoursPerDay,
            payableWorkingHours: calc.payableWorkingHours,
            eligibleWorkingHours: calc.eligibleWorkingHours,
            approvedOtHours: calc.approvedOtHours,
            otRate: calc.otRate,
            otPayment: calc.otPayment,
            incompleteHours: calc.incompleteHours,
            incompleteDeductionRate: calc.incompleteDeductionRate,
            incompleteDeductionAmount: calc.incompleteDeductionAmount,
            approvedIncentivesAmount: calc.approvedIncentivesAmount,
            additionalEarnings: calc.additionalEarnings,
            otherDeductions: calc.otherDeductions,
            grossEarnings: calc.grossEarnings,
            totalDeductions: calc.totalDeductions,
            netSalary: calc.netSalary,
            presentDaysCount: calc.presentDaysCount,
            leaveDaysCount: calc.leaveDaysCount,
            absentDaysCount: calc.absentDaysCount,
            calculationBreakdownJson: JSON.stringify(calc.calculationBreakdown),
            snapshotConfigJson: JSON.stringify(calc.snapshotConfig),
            status: 'PENDING_REVIEW'
          }
        });
      }
    }

    const totalMins = Math.round(parsedHours * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    const durStr = h > 0 && m > 0 ? `${h}h ${m}m (${totalMins} mins)` : h > 0 ? `${h} hours (${totalMins} mins)` : `${m} minutes`;
    const ratePerMin = otRate > 0 ? (otRate / 60).toFixed(2) : '0.00';

    return sendSuccess(
      res,
      {
        overtimeRecord: otRecord,
        additionalSalary: otAmount,
        updatedPayroll
      },
      `Overtime logged: ${durStr} at ₹${otRate}/hr (₹${ratePerMin}/min) = ₹${otAmount} additional salary`
    );
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to create overtime record', 500);
  }
};

export const updateOvertimeStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // APPROVED or REJECTED

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return sendError(res, 'Status must be APPROVED or REJECTED', 400);
    }

    const otRecord = await prisma.overtimeRecord.findUnique({
      where: { id },
      include: { employee: true }
    });

    if (!otRecord) return sendError(res, 'Overtime record not found', 404);

    const updated = await prisma.overtimeRecord.update({
      where: { id },
      data: {
        status,
        approvedById: req.user?.id,
        approvedAt: new Date()
      }
    });

    let updatedPayroll = null;
    if (status === 'APPROVED') {
      const { startDate, endDate } = getMonthBounds(otRecord.payrollMonth);
      const payrollPeriod = await prisma.payrollPeriod.findUnique({
        where: { brandId_period: { brandId: otRecord.brandId, period: otRecord.payrollMonth } }
      });

      if (payrollPeriod && payrollPeriod.status !== 'FINALIZED') {
        const calc = await salaryCalculator.calculateSalary({
          employeeId: otRecord.employeeId,
          brandId: otRecord.brandId,
          payrollMonth: otRecord.payrollMonth,
          startDate,
          endDate
        });

        updatedPayroll = await prisma.employeePayroll.update({
          where: {
            payrollPeriodId_employeeId: {
              payrollPeriodId: payrollPeriod.id,
              employeeId: otRecord.employeeId
            }
          },
          data: {
            approvedOtHours: calc.approvedOtHours,
            otRate: calc.otRate,
            otPayment: calc.otPayment,
            grossEarnings: calc.grossEarnings,
            netSalary: calc.netSalary,
            calculationBreakdownJson: JSON.stringify(calc.calculationBreakdown)
          }
        });
      }
    }

    return sendSuccess(
      res,
      { updated, updatedPayroll },
      `Overtime record ${status.toLowerCase()} and salary recalculated.`
    );
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to update overtime status', 500);
  }
};

/**
 * Manually trigger making salary receipt and emailing it to staff
 */
export const sendSalaryReceiptMailHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employeePayrollId, employeeId, period } = req.body;
    let targetPayrollId = employeePayrollId;

    if (!targetPayrollId && employeeId && period) {
      const ep = await prisma.employeePayroll.findFirst({
        where: {
          employeeId,
          payrollPeriod: { period }
        }
      });
      if (ep) targetPayrollId = ep.id;
    }

    if (!targetPayrollId) {
      return sendError(res, 'employeePayrollId or (employeeId and period) are required', 400);
    }

    const result = await makeSalaryReceiptAndSendMail(targetPayrollId);
    return sendSuccess(
      res,
      result,
      result.emailSent
        ? `Salary receipt ${result.receiptNumber} successfully emailed to ${result.emailTo}`
        : `Salary receipt ${result.receiptNumber} generated, but email was not sent (${result.error || 'No email address'})`
    );
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to send salary receipt email', 500);
  }
};

