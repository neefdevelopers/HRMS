import { prisma } from '../config/prisma.js';
import { shiftService } from './shiftService.js';
import { systemSettingService, DEFAULT_PAYROLL_SETTINGS } from './systemSettingService.js';

export interface CalculationInput {
  employeeId: string;
  brandId: string;
  payrollMonth: string; // YYYY-MM e.g. "2026-10"
  startDate: string;    // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD
  overrideOtHours?: number;
  overrideIncompleteHours?: number;
}

export interface DailyAttendanceSummary {
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  workingHours: number;
  expectedHours: number;
  otHours: number;
  incompleteHours: number;
  isLeaveOrHoliday: boolean;
  hasMissingPunch: boolean;
}

export interface SalaryCalculationResult {
  employeeId: string;
  brandId: string;
  salaryConfigId: string;
  currency: string;
  
  // Base fixed salary & proration
  baseSalary: number;
  payableSalary: number;
  isProrated: boolean;
  prorationReason?: string;
  activeCalendarDays: number;
  totalCalendarDaysInMonth: number;
  
  // Working days and hours
  standardWorkingDays: number;
  standardWorkingHoursPerDay: number;
  payableWorkingHours: number;
  eligibleWorkingHours: number;
  
  // Overtime
  otCalculationMethod: string;
  approvedOtHours: number;
  otRate: number;
  otPayment: number;
  overtimeRecordsList: Array<{
    id: string;
    date: string;
    hours: number;
    otRate: number;
    otAmount: number;
    reason: string | null;
  }>;
  
  // Incomplete Hours
  incompleteHoursDeductionMethod: string;
  incompleteHours: number;
  incompleteDeductionRate: number;
  incompleteDeductionAmount: number;
  
  // Incentives
  approvedIncentivesAmount: number;
  incentivesList: Array<{
    id: string;
    title: string;
    amount: number;
    incentiveType: string;
    calculatedAmount: number;
  }>;
  
  // Adjustments
  additionalEarnings: number;
  otherDeductions: number;
  adjustmentsList: Array<{
    id: string;
    type: string;
    amount: number;
    reason: string;
  }>;
  
  // Summary
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
  
  // Stats
  presentDaysCount: number;
  leaveDaysCount: number;
  absentDaysCount: number;
  hasMissingPunchFlags: boolean;
  missingPunchDates: string[];
  
  // Audit breakdown
  calculationBreakdown: {
    formula: string;
    hourlyBaseRate: number;
    dailyLogs: DailyAttendanceSummary[];
  };
  snapshotConfig: any;
}

export class SalaryCalculatorService {
  /**
   * Retrieves the applicable salary configuration for an employee on a given period.
   * Matches active configs effective on or before the period end date.
   */
  async getEffectiveSalaryConfig(employeeId: string, periodStartDate: string, periodEndDate: string) {
    const configs = await prisma.employeeSalaryConfig.findMany({
      where: {
        employeeId,
        status: 'ACTIVE',
        effectiveFrom: { lte: periodEndDate },
        OR: [
          { effectiveUntil: null },
          { effectiveUntil: { gte: periodStartDate } }
        ]
      },
      orderBy: { effectiveFrom: 'desc' },
      take: 1
    });

    return configs[0] || null;
  }

  /**
   * Performs the full monthly salary calculation for an employee.
   */
  async calculateSalary(input: CalculationInput): Promise<SalaryCalculationResult> {
    const { employeeId, brandId, payrollMonth, startDate, endDate } = input;

    // 1. Fetch Employee details
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        brand: true,
        branch: true,
        department: true,
        designation: true,
        shift: true
      }
    });

    if (!employee) {
      throw new Error(`Employee with ID ${employeeId} not found.`);
    }

    // 2. Fetch Effective Salary Config (fallback if employee.monthlySalary is not yet set)
    const config = await this.getEffectiveSalaryConfig(employeeId, startDate, endDate);
    
    // Fixed salary stored in Employee Details is the source of truth
    const fixedMonthlySalary = ((employee as any).monthlySalary !== undefined && (employee as any).monthlySalary > 0)
      ? Number((employee as any).monthlySalary)
      : (config ? config.monthlySalary : 0);

    // 3. Proration Calculation
    // Total calendar days in the month
    const startObj = new Date(startDate);
    const endObj = new Date(endDate);
    const totalDaysInMonth = Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    let activeDays = totalDaysInMonth;
    let isProrated = false;
    let prorationReason = '';

    // Check joining date
    if (employee.joiningDate && employee.joiningDate > startDate) {
      const joinObj = new Date(employee.joiningDate);
      if (joinObj <= endObj) {
        const daysActiveFromJoin = Math.round((endObj.getTime() - joinObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        activeDays = Math.min(activeDays, daysActiveFromJoin);
        isProrated = true;
        prorationReason = `Joined on ${employee.joiningDate} (active ${activeDays}/${totalDaysInMonth} days)`;
      } else {
        activeDays = 0;
        isProrated = true;
        prorationReason = `Joined after payroll period (${employee.joiningDate})`;
      }
    }

    // Check exit date
    if (employee.exitDate && employee.exitDate < endDate) {
      const exitObj = new Date(employee.exitDate);
      if (exitObj >= startObj) {
        const daysActiveBeforeExit = Math.round((exitObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        activeDays = Math.min(activeDays, daysActiveBeforeExit);
        isProrated = true;
        prorationReason = `Relieved on ${employee.exitDate} (active ${activeDays}/${totalDaysInMonth} days)`;
      }
    }

    const prorationRatio = totalDaysInMonth > 0 ? Math.max(0, Math.min(1, activeDays / totalDaysInMonth)) : 1;
    const baseSalary = fixedMonthlySalary;
    const payableSalary = isProrated
      ? Number((baseSalary * prorationRatio).toFixed(2))
      : baseSalary;

    // 4. Working Hours & Base Hourly Rate
    const standardWorkingDays = config?.standardWorkingDays || 26;
    const brandGenderDailyHours = await systemSettingService.getRequiredDailyHours(
      employee.brandId,
      (employee as any).gender
    );
    const standardWorkingHoursPerDay = employee.shift?.fullDayThresholdHours || config?.standardWorkingHoursPerDay || brandGenderDailyHours;
    const payableWorkingHours = Number((standardWorkingDays * standardWorkingHoursPerDay).toFixed(2));
    
    // Hourly rate = Applicable fixed salary ÷ Configured monthly payable working hours
    const hourlyBaseRate = payableWorkingHours > 0
      ? Number((payableSalary / payableWorkingHours).toFixed(2))
      : 0;

    // 5. Fetch Attendance Records for the Period
    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate }
      },
      orderBy: { date: 'asc' }
    });

    let eligibleWorkingHours = 0;
    let computedOtHours = 0;
    let computedIncompleteHours = 0;
    let presentDaysCount = 0;
    let leaveDaysCount = 0;
    let absentDaysCount = 0;
    let hasMissingPunchFlags = false;
    const missingPunchDates: string[] = [];
    const dailyLogs: DailyAttendanceSummary[] = [];

    // Map each attendance record
    for (const att of attendances) {
      // Resolve shift for this employee on this date (respects assigned shift, rotations, break minutes, and weekly off)
      const resolved = await shiftService.resolveShiftForEmployeeDate(employeeId, att.date, employee.shift);
      const isShiftWeeklyOff = resolved.isWeeklyOff;
      const dayExpectedHours = isShiftWeeklyOff ? 0 : (resolved.shift.expectedWorkingHours || brandGenderDailyHours);

      const isLeave = att.status === 'ON_LEAVE' || att.status === 'HOLIDAY' || att.status === 'WEEK_OFF' || isShiftWeeklyOff;
      const isPresent = att.status === 'PRESENT' || att.status === 'LATE' || att.status === 'HALF_DAY';
      const isAbsent = att.status === 'ABSENT' && !isShiftWeeklyOff;

      if (isPresent) presentDaysCount++;
      if (att.status === 'ON_LEAVE') leaveDaysCount++;
      if (isAbsent) absentDaysCount++;

      // Check missing punches: e.g. checked in but no checkOut, or status absent with incomplete punch
      const hasMissingPunch = Boolean(att.checkIn && !att.checkOut);
      if (hasMissingPunch) {
        hasMissingPunchFlags = true;
        missingPunchDates.push(att.date);
      }

      const dayWorkingHours = Number(att.workingHours || 0);
      eligibleWorkingHours += dayWorkingHours;

      let dayOt = 0;
      let dayIncomplete = 0;

      if (isShiftWeeklyOff) {
        // If employee worked on weekly off, all working hours count as overtime
        if (dayWorkingHours > 0) {
          dayOt = dayWorkingHours;
        }
      } else if (!isLeave) {
        if (hasMissingPunch) {
          // If attendance data is missing or invalid, flag it for review instead of calculating an incorrect deduction
          dayIncomplete = 0;
        } else if (dayWorkingHours > dayExpectedHours) {
          dayOt = Number((dayWorkingHours - dayExpectedHours).toFixed(2));
        } else if (dayWorkingHours < dayExpectedHours) {
          dayIncomplete = Number((dayExpectedHours - dayWorkingHours).toFixed(2));
        }
      }

      computedOtHours += dayOt;
      computedIncompleteHours += dayIncomplete;

      dailyLogs.push({
        date: att.date,
        status: att.status,
        checkIn: att.checkIn ? att.checkIn.toISOString() : null,
        checkOut: att.checkOut ? att.checkOut.toISOString() : null,
        workingHours: dayWorkingHours,
        expectedHours: isLeave ? 0 : dayExpectedHours,
        otHours: dayOt,
        incompleteHours: dayIncomplete,
        isLeaveOrHoliday: isLeave,
        hasMissingPunch
      });
    }

    // 5B. Fetch explicitly logged & approved Overtime Records for this period
    const approvedOtRecords = await prisma.overtimeRecord.findMany({
      where: {
        employeeId,
        payrollMonth,
        status: 'APPROVED'
      },
      orderBy: { date: 'asc' }
    });

    let loggedApprovedOtHours = 0;
    const overtimeRecordsList = approvedOtRecords.map((ot) => {
      loggedApprovedOtHours += ot.hours;
      return {
        id: ot.id,
        date: ot.date,
        hours: ot.hours,
        otRate: ot.otRate,
        otAmount: ot.otAmount,
        reason: ot.reason
      };
    });

    // 6. Overtime Calculation
    const payrollRules = await systemSettingService.getSettingValue('payroll.rules', DEFAULT_PAYROLL_SETTINGS);
    const otMethod = config?.otCalculationMethod || payrollRules.otCalculationMethod || 'STANDARD_MULTIPLIER';
    let otRate = hourlyBaseRate * (payrollRules.defaultOtMultiplier || 1.5);
    if (otMethod === 'CUSTOM_RATE' && (config?.otRatePerHour || payrollRules.customOtRatePerHour)) {
      otRate = config?.otRatePerHour || payrollRules.customOtRatePerHour;
    } else if (otMethod === 'NONE') {
      otRate = 0;
    }

    const totalCalculatedOtHours = Number((computedOtHours + loggedApprovedOtHours).toFixed(2));
    const approvedOtHours = input.overrideOtHours !== undefined
      ? input.overrideOtHours
      : totalCalculatedOtHours;

    const otPayment = Number((approvedOtHours * otRate).toFixed(2));

    const incompleteHours = input.overrideIncompleteHours !== undefined
      ? input.overrideIncompleteHours
      : Number(computedIncompleteHours.toFixed(2));

    // 7. Incomplete Hours Deduction Calculation
    const deductionMethod = config?.incompleteHoursDeductionMethod || payrollRules.incompleteDeductionMethod || 'HOURLY_PRORATED';
    let incompleteDeductionRate = hourlyBaseRate;
    if (deductionMethod === 'CUSTOM_RATE' && (config?.incompleteDeductionRatePerHour || payrollRules.customIncompleteRatePerHour)) {
      incompleteDeductionRate = config?.incompleteDeductionRatePerHour || payrollRules.customIncompleteRatePerHour;
    } else if (deductionMethod === 'NONE') {
      incompleteDeductionRate = 0;
    }

    const incompleteDeductionAmount = Number((incompleteHours * incompleteDeductionRate).toFixed(2));

    // 8. Incentives (Optional, default to 0 if none added)
    const incentives = await prisma.incentive.findMany({
      where: {
        employeeId,
        payrollMonth,
        status: { in: ['APPROVED', 'PENDING'] }
      }
    });

    let approvedIncentivesAmount = 0;
    const incentivesList = incentives.map((inc) => {
      let finalAmount = inc.amount;
      if (inc.incentiveType === 'PERCENTAGE') {
        const base = inc.calculationBase === 'PAYABLE_SALARY' ? payableSalary : baseSalary;
        finalAmount = Number(((inc.amount / 100) * base).toFixed(2));
      }
      approvedIncentivesAmount += finalAmount;
      return {
        id: inc.id,
        title: inc.title || 'Incentive',
        amount: inc.amount,
        incentiveType: inc.incentiveType,
        calculatedAmount: finalAmount
      };
    });

    // 9. Approved Additional Earnings & Other Deductions (if any existing)
    const adjustments = await prisma.payrollAdjustment.findMany({
      where: {
        employeeId,
        payrollMonth,
        status: 'APPROVED'
      }
    });

    let additionalEarnings = 0;
    let otherDeductions = 0;
    const adjustmentsList = adjustments.map((adj) => {
      if (adj.type === 'ADDITIONAL_EARNING') {
        additionalEarnings += adj.amount;
      } else if (adj.type === 'OTHER_DEDUCTION') {
        otherDeductions += adj.amount;
      }
      return {
        id: adj.id,
        type: adj.type,
        amount: adj.amount,
        reason: adj.reason
      };
    });

    // 10. Summary Totals (Final Salary = Fixed Salary + Overtime Amount + Incentives − Incomplete Hours Deduction)
    const grossEarnings = Number(
      (payableSalary + otPayment + approvedIncentivesAmount + additionalEarnings).toFixed(2)
    );
    const totalDeductions = Number(
      (incompleteDeductionAmount + otherDeductions).toFixed(2)
    );
    const netSalary = Math.max(0, Number((grossEarnings - totalDeductions).toFixed(2)));

    return {
      employeeId,
      brandId,
      salaryConfigId: config ? config.id : '',
      currency: config?.currency || 'INR',
      baseSalary,
      payableSalary,
      isProrated,
      prorationReason,
      activeCalendarDays: activeDays,
      totalCalendarDaysInMonth: totalDaysInMonth,
      standardWorkingDays,
      standardWorkingHoursPerDay,
      payableWorkingHours,
      eligibleWorkingHours: Number(eligibleWorkingHours.toFixed(2)),
      otCalculationMethod: config?.otCalculationMethod || 'STANDARD_HOURLY',
      approvedOtHours,
      otRate,
      otPayment,
      overtimeRecordsList,
      incompleteHoursDeductionMethod: config?.incompleteHoursDeductionMethod || 'STANDARD_HOURLY',
      incompleteHours,
      incompleteDeductionRate,
      incompleteDeductionAmount,
      approvedIncentivesAmount: Number(approvedIncentivesAmount.toFixed(2)),
      incentivesList,
      additionalEarnings: Number(additionalEarnings.toFixed(2)),
      otherDeductions: Number(otherDeductions.toFixed(2)),
      adjustmentsList,
      grossEarnings,
      totalDeductions,
      netSalary,
      presentDaysCount,
      leaveDaysCount,
      absentDaysCount,
      hasMissingPunchFlags,
      missingPunchDates,
      calculationBreakdown: {
        formula: 'Final Salary = Fixed Salary + Overtime Amount + Incentives − Incomplete Hours Deduction',
        hourlyBaseRate,
        dailyLogs
      },
      snapshotConfig: {
        id: config?.id || 'emp-profile',
        monthlySalary: baseSalary,
        currency: config?.currency || 'INR',
        standardWorkingDays,
        standardWorkingHoursPerDay
      }
    };
  }
}

export const salaryCalculator = new SalaryCalculatorService();
