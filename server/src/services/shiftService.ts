import { prisma } from '../config/prisma.js';

export interface ShiftDetails {
  id: string;
  name: string;
  code: string;
  brandId: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  breakMinutes: number;
  weeklyOff: string; // e.g. "SUNDAY" or "SATURDAY,SUNDAY"
  gracePeriodMinutes: number;
  isNightShift: boolean;
  isDefault: boolean;
  expectedWorkingHours: number;
}

export interface ResolvedDailyShift {
  date: string;
  shift: ShiftDetails;
  isWeeklyOff: boolean;
  isRotational: boolean;
  assignmentId?: string;
}

export interface ShiftWiseAttendanceRecord {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  date: string;
  shift: {
    id: string;
    name: string;
    code: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    weeklyOff: string;
    isNightShift: boolean;
    expectedWorkingHours: number;
  };
  checkIn: string | null;
  checkOut: string | null;
  workingHours: number;
  expectedHours: number;
  lateMinutes: number;
  incompleteHours: number;
  overtimeHours: number;
  status: string; // PRESENT, LATE, HALF_DAY, ABSENT, ON_LEAVE, WEEK_OFF, HOLIDAY
  isWeeklyOff: boolean;
  isOvernight: boolean;
}

export class ShiftService {
  /**
   * Helper: Check if shift crosses midnight (overnight shift)
   */
  isOvernight(startTime: string, endTime: string): boolean {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    return endMins < startMins;
  }

  /**
   * Helper: Calculate net expected working hours for a shift
   */
  calculateExpectedWorkingHours(startTime: string, endTime: string, breakMinutes = 60): number {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    let startMins = sh * 60 + sm;
    let endMins = eh * 60 + em;
    if (endMins < startMins) {
      endMins += 24 * 60; // crosses midnight
    }
    const totalDurationMins = endMins - startMins;
    const netMins = Math.max(0, totalDurationMins - (breakMinutes || 0));
    return Number((netMins / 60).toFixed(2));
  }

  /**
   * Helper: Get day name from date string YYYY-MM-DD
   */
  getDayOfWeekName(dateStr: string): string {
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const d = new Date(dateStr + 'T00:00:00Z');
    return days[d.getUTCDay()];
  }

  /**
   * Helper: Check if a date is weekly off for a given weeklyOff configuration
   */
  isWeeklyOff(dateStr: string, weeklyOffConfig = 'SUNDAY'): boolean {
    const dayName = this.getDayOfWeekName(dateStr);
    const configuredDays = (weeklyOffConfig || 'SUNDAY')
      .split(',')
      .map(s => s.trim().toUpperCase());
    return configuredDays.includes(dayName);
  }

  /**
   * 1. SHIFTS CRUD
   */
  async getShifts(brandId?: string, companyId?: string) {
    const where: any = {};
    if (companyId) {
      where.brand = { companyId };
    }
    if (brandId && brandId !== 'all') {
      where.brandId = brandId;
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true, code: true } },
        _count: { select: { employees: true, assignments: true } }
      },
      orderBy: { startTime: 'asc' }
    });

    return shifts.map(s => ({
      ...s,
      isNightShift: this.isOvernight(s.startTime, s.endTime),
      expectedWorkingHours: this.calculateExpectedWorkingHours(s.startTime, s.endTime, s.breakMinutes)
    }));
  }

  async createShift(data: {
    brandId: string;
    name: string;
    code: string;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
    weeklyOff?: string;
    gracePeriodMinutes?: number;
    isDefault?: boolean;
  }) {
    const breakMinutes = data.breakMinutes !== undefined ? data.breakMinutes : 60;
    const weeklyOff = data.weeklyOff ? data.weeklyOff.toUpperCase() : 'SUNDAY';
    const isNightShift = this.isOvernight(data.startTime, data.endTime);
    const gracePeriodMinutes = data.gracePeriodMinutes || 15;

    // If marked as default, unmark other defaults for this brand
    if (data.isDefault) {
      await prisma.shift.updateMany({
        where: { brandId: data.brandId },
        data: { isDefault: false }
      });
    }

    const created = await prisma.shift.create({
      data: {
        brandId: data.brandId,
        name: data.name,
        code: data.code.toUpperCase(),
        startTime: data.startTime,
        endTime: data.endTime,
        breakMinutes,
        weeklyOff,
        gracePeriodMinutes,
        isNightShift,
        isDefault: Boolean(data.isDefault)
      },
      include: { brand: true }
    });

    return {
      ...created,
      expectedWorkingHours: this.calculateExpectedWorkingHours(created.startTime, created.endTime, created.breakMinutes)
    };
  }

  async updateShift(id: string, data: {
    name?: string;
    code?: string;
    startTime?: string;
    endTime?: string;
    breakMinutes?: number;
    weeklyOff?: string;
    gracePeriodMinutes?: number;
    isDefault?: boolean;
  }) {
    const existing = await prisma.shift.findUnique({ where: { id } });
    if (!existing) throw new Error('Shift not found');

    const startTime = data.startTime || existing.startTime;
    const endTime = data.endTime || existing.endTime;
    const isNightShift = this.isOvernight(startTime, endTime);

    if (data.isDefault) {
      await prisma.shift.updateMany({
        where: { brandId: existing.brandId, id: { not: id } },
        data: { isDefault: false }
      });
    }

    const updated = await prisma.shift.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.code ? { code: data.code.toUpperCase() } : {}),
        ...(data.startTime ? { startTime: data.startTime } : {}),
        ...(data.endTime ? { endTime: data.endTime } : {}),
        ...(data.breakMinutes !== undefined ? { breakMinutes: data.breakMinutes } : {}),
        ...(data.weeklyOff ? { weeklyOff: data.weeklyOff.toUpperCase() } : {}),
        ...(data.gracePeriodMinutes !== undefined ? { gracePeriodMinutes: data.gracePeriodMinutes } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        isNightShift
      },
      include: { brand: true }
    });

    return {
      ...updated,
      expectedWorkingHours: this.calculateExpectedWorkingHours(updated.startTime, updated.endTime, updated.breakMinutes)
    };
  }

  async deleteShift(id: string) {
    const existing = await prisma.shift.findUnique({
      where: { id },
      include: { _count: { select: { employees: true, assignments: true } } }
    });
    if (!existing) throw new Error('Shift not found');

    if (existing._count.employees > 0 || existing._count.assignments > 0) {
      throw new Error(`Cannot delete shift "${existing.name}". It is assigned to active employees.`);
    }

    await prisma.shift.delete({ where: { id } });
    return { success: true };
  }

  /**
   * 2. EMPLOYEE SHIFT ASSIGNMENT & ROTATIONS
   */
  async assignShifts(data: {
    brandId: string;
    employeeIds: string[];
    shiftId: string;
    startDate: string; // YYYY-MM-DD
    endDate?: string;
    isRotational?: boolean;
    rotationFrequency?: 'WEEKLY' | 'MONTHLY';
    rotationShiftIds?: string[];
    notes?: string;
  }) {
    const { brandId, employeeIds, shiftId, startDate, endDate, isRotational, rotationFrequency, rotationShiftIds, notes } = data;

    if (!employeeIds || employeeIds.length === 0) {
      throw new Error('At least one employee must be selected.');
    }

    const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new Error('Primary shift not found.');

    const createdAssignments = [];

    for (const empId of employeeIds) {
      // 1. Close or update any overlapping active assignment starting on or before this startDate
      await prisma.shiftAssignment.updateMany({
        where: {
          employeeId: empId,
          endDate: null,
          startDate: { lt: startDate }
        },
        data: {
          endDate: startDate // end previous assignment when new assignment starts
        }
      });

      // 2. Create the assignment
      const assignment = await prisma.shiftAssignment.create({
        data: {
          brandId,
          employeeId: empId,
          shiftId,
          startDate,
          endDate: endDate || null,
          isRotational: Boolean(isRotational),
          rotationFrequency: isRotational ? (rotationFrequency || 'WEEKLY') : null,
          rotationShiftIds: isRotational && rotationShiftIds?.length ? JSON.stringify(rotationShiftIds) : null,
          notes: notes || null
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
          shift: true
        }
      });

      // 3. Keep Employee.shiftId updated with current active shift for legacy compatibility
      await prisma.employee.update({
        where: { id: empId },
        data: { shiftId }
      });

      createdAssignments.push(assignment);
    }

    return {
      assignedCount: createdAssignments.length,
      assignments: createdAssignments
    };
  }

  async getAssignments(brandId?: string, employeeId?: string, companyId?: string) {
    const where: any = {};
    if (companyId) where.brand = { companyId };
    if (brandId && brandId !== 'all') where.brandId = brandId;
    if (employeeId) where.employeeId = employeeId;

    const assignments = await prisma.shiftAssignment.findMany({
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
        shift: true
      },
      orderBy: { startDate: 'desc' }
    });

    return assignments.map(a => {
      let parsedRotationShifts: string[] = [];
      if (a.rotationShiftIds) {
        try {
          parsedRotationShifts = JSON.parse(a.rotationShiftIds);
        } catch {
          parsedRotationShifts = [];
        }
      }
      return {
        ...a,
        rotationShifts: parsedRotationShifts
      };
    });
  }

  async deleteAssignment(id: string) {
    const assignment = await prisma.shiftAssignment.findUnique({ where: { id } });
    if (!assignment) throw new Error('Assignment not found');

    await prisma.shiftAssignment.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Helper: Resolves which shift applies to an employee on a specific date YYYY-MM-DD
   */
  async resolveShiftForEmployeeDate(
    employeeId: string,
    dateStr: string,
    employeeDefaultShift?: any,
    cachedAssignments?: any[],
    shiftsMap?: Map<string, any>
  ): Promise<ResolvedDailyShift> {
    // 1. Find matching assignment covering dateStr
    let matchingAssignment: any = null;

    if (cachedAssignments) {
      matchingAssignment = cachedAssignments.find(
        a => a.employeeId === employeeId &&
             a.startDate <= dateStr &&
             (!a.endDate || a.endDate >= dateStr)
      );
    } else {
      matchingAssignment = await prisma.shiftAssignment.findFirst({
        where: {
          employeeId,
          startDate: { lte: dateStr },
          OR: [
            { endDate: null },
            { endDate: { gte: dateStr } }
          ]
        },
        include: { shift: true },
        orderBy: { startDate: 'desc' }
      });
    }

    let resolvedShiftRecord: any = null;
    let isRotational = false;

    if (matchingAssignment) {
      if (matchingAssignment.isRotational && matchingAssignment.rotationShiftIds) {
        isRotational = true;
        let rotationList: string[] = [];
        try {
          rotationList = JSON.parse(matchingAssignment.rotationShiftIds);
        } catch {
          rotationList = [matchingAssignment.shiftId];
        }

        if (rotationList.length > 0) {
          // Calculate interval index from assignment startDate
          const startD = new Date(matchingAssignment.startDate + 'T00:00:00Z');
          const currD = new Date(dateStr + 'T00:00:00Z');
          let rotationIndex = 0;

          if (matchingAssignment.rotationFrequency === 'MONTHLY') {
            const startYear = startD.getUTCFullYear();
            const startMonth = startD.getUTCMonth();
            const currYear = currD.getUTCFullYear();
            const currMonth = currD.getUTCMonth();
            const monthsPassed = Math.max(0, (currYear - startYear) * 12 + (currMonth - startMonth));
            rotationIndex = monthsPassed % rotationList.length;
          } else {
            // Default WEEKLY rotation
            const daysDiff = Math.max(0, Math.floor((currD.getTime() - startD.getTime()) / (1000 * 3600 * 24)));
            const weeksPassed = Math.floor(daysDiff / 7);
            rotationIndex = weeksPassed % rotationList.length;
          }

          const targetShiftId = rotationList[rotationIndex];
          if (shiftsMap && shiftsMap.has(targetShiftId)) {
            resolvedShiftRecord = shiftsMap.get(targetShiftId);
          } else {
            resolvedShiftRecord = await prisma.shift.findUnique({ where: { id: targetShiftId } });
          }
        }
      }

      if (!resolvedShiftRecord) {
        resolvedShiftRecord = matchingAssignment.shift;
      }
    }

    // Fallback to employee default shift or first default shift
    if (!resolvedShiftRecord) {
      resolvedShiftRecord = employeeDefaultShift;
    }

    // Safety fallback
    if (!resolvedShiftRecord) {
      resolvedShiftRecord = {
        id: 'default-general',
        name: 'General Shift',
        code: 'GEN',
        startTime: '09:00',
        endTime: '18:00',
        breakMinutes: 60,
        weeklyOff: 'SUNDAY',
        gracePeriodMinutes: 15,
        isNightShift: false,
        isDefault: true
      };
    }

    const shiftDetails: ShiftDetails = {
      id: resolvedShiftRecord.id,
      name: resolvedShiftRecord.name,
      code: resolvedShiftRecord.code,
      brandId: resolvedShiftRecord.brandId || '',
      startTime: resolvedShiftRecord.startTime,
      endTime: resolvedShiftRecord.endTime,
      breakMinutes: resolvedShiftRecord.breakMinutes || 60,
      weeklyOff: resolvedShiftRecord.weeklyOff || 'SUNDAY',
      gracePeriodMinutes: resolvedShiftRecord.gracePeriodMinutes || 15,
      isNightShift: this.isOvernight(resolvedShiftRecord.startTime, resolvedShiftRecord.endTime),
      isDefault: Boolean(resolvedShiftRecord.isDefault),
      expectedWorkingHours: this.calculateExpectedWorkingHours(
        resolvedShiftRecord.startTime,
        resolvedShiftRecord.endTime,
        resolvedShiftRecord.breakMinutes
      )
    };

    const isWeeklyOff = this.isWeeklyOff(dateStr, shiftDetails.weeklyOff);

    return {
      date: dateStr,
      shift: shiftDetails,
      isWeeklyOff,
      isRotational,
      assignmentId: matchingAssignment?.id
    };
  }

  /**
   * 4. SHIFT CALENDAR & MONTHLY ROSTER
   */
  async getShiftCalendar(params: { brandId?: string; companyId?: string; period: string; search?: string }) {
    const { brandId, companyId, period, search } = params;
    const [yearStr, monthStr] = period.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const whereBrand: any = {};
    if (companyId) whereBrand.brand = { companyId };
    if (brandId && brandId !== 'all') whereBrand.brandId = brandId;

    // Fetch employees
    const andClauses: any[] = [{ employeeStatus: 'ACTIVE' }];
    if (companyId) {
      andClauses.push({
        OR: [
          { companyId },
          { brand: { companyId } }
        ]
      });
    }
    if (brandId && brandId !== 'all') {
      andClauses.push({ brandId });
    }
    if (search) {
      andClauses.push({
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { employeeId: { contains: search } }
        ]
      });
    }
    const whereEmp: any = andClauses.length > 0 ? { AND: andClauses } : {};

    const employees = await prisma.employee.findMany({
      where: whereEmp,
      include: {
        shift: true,
        department: { select: { name: true } },
        designation: { select: { title: true } },
        brand: { select: { name: true, code: true } }
      },
      orderBy: { employeeId: 'asc' }
    });

    // Fetch all shifts in brand for lookup cache
    const allShifts = await prisma.shift.findMany({ where: whereBrand });
    const shiftsMap = new Map<string, any>(allShifts.map(s => [s.id, s]));

    // Fetch all shift assignments in brand
    const assignments = await prisma.shiftAssignment.findMany({
      where: whereBrand,
      include: { shift: true }
    });

    const datesList: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      datesList.push(`${period}-${day.toString().padStart(2, '0')}`);
    }

    const roster: any[] = [];

    for (const emp of employees) {
      const schedule: Record<string, any> = {};

      for (const dStr of datesList) {
        const resolved = await this.resolveShiftForEmployeeDate(
          emp.id,
          dStr,
          emp.shift,
          assignments,
          shiftsMap
        );

        schedule[dStr] = {
          date: dStr,
          shiftId: resolved.shift.id,
          shiftName: resolved.shift.name,
          shiftCode: resolved.shift.code,
          startTime: resolved.shift.startTime,
          endTime: resolved.shift.endTime,
          isNightShift: resolved.shift.isNightShift,
          isWeeklyOff: resolved.isWeeklyOff,
          isRotational: resolved.isRotational
        };
      }

      roster.push({
        employee: {
          id: emp.id,
          employeeId: emp.employeeId,
          firstName: emp.firstName,
          lastName: emp.lastName,
          department: emp.department?.name,
          designation: emp.designation?.title,
          brand: emp.brand?.name
        },
        schedule
      });
    }

    return {
      period,
      daysInMonth,
      dates: datesList,
      totalEmployees: employees.length,
      roster
    };
  }

  /**
   * 5. SHIFT-WISE ATTENDANCE
   * Connects assigned shifts with punching & attendance data,
   * accurately calculating late arrivals, overnight shifts, incomplete hours, and overtime.
   */
  async getShiftWiseAttendance(params: { brandId?: string; companyId?: string; date: string; search?: string }) {
    const { brandId, companyId, date: dateStr, search } = params;

    const whereBrand: any = {};
    if (companyId) whereBrand.brand = { companyId };
    if (brandId && brandId !== 'all') whereBrand.brandId = brandId;

    const andClauses: any[] = [{ employeeStatus: 'ACTIVE' }];
    if (companyId) {
      andClauses.push({
        OR: [
          { companyId },
          { brand: { companyId } }
        ]
      });
    }
    if (brandId && brandId !== 'all') {
      andClauses.push({ brandId });
    }
    if (search) {
      andClauses.push({
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { employeeId: { contains: search } }
        ]
      });
    }
    const whereEmp: any = andClauses.length > 0 ? { AND: andClauses } : {};

    const employees = await prisma.employee.findMany({
      where: whereEmp,
      include: {
        shift: true,
        department: { select: { name: true } },
        designation: { select: { title: true } }
      },
      orderBy: { employeeId: 'asc' }
    });

    const allShifts = await prisma.shift.findMany({ where: whereBrand });
    const shiftsMap = new Map<string, any>(allShifts.map(s => [s.id, s]));

    const assignments = await prisma.shiftAssignment.findMany({
      where: whereBrand,
      include: { shift: true }
    });

    // Fetch existing attendance records for date
    const attendances = await prisma.attendance.findMany({
      where: {
        date: dateStr,
        employee: whereBrand
      }
    });
    const attMap = new Map<string, any>(attendances.map(a => [a.employeeId, a]));

    // Fetch approved leaves on this date
    const leaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: dateStr },
        endDate: { gte: dateStr }
      }
    });
    const leaveMap = new Map<string, any>(leaves.map(l => [l.employeeId, l]));

    // Fetch holidays on this date
    const holiday = await prisma.holiday.findFirst({
      where: {
        date: dateStr,
        ...(brandId && brandId !== 'all' ? { OR: [{ brandId }, { brandId: null }] } : {})
      }
    });

    // Date bounds for punch records
    // If night shift crosses midnight, punch out can be on next day morning!
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const nextDayStr = new Date(dayStart.getTime() + 86400000).toISOString().split('T')[0];
    const windowEnd = new Date(`${nextDayStr}T14:00:00.000Z`); // window extends to next day afternoon for night shifts

    const allPunches = await prisma.punchRecord.findMany({
      where: {
        punchTime: { gte: dayStart, lte: windowEnd }
      },
      orderBy: { punchTime: 'asc' }
    });

    const punchesByEmp = new Map<string, any[]>();
    for (const p of allPunches) {
      if (!p.employeeId) continue;
      if (!punchesByEmp.has(p.employeeId)) punchesByEmp.set(p.employeeId, []);
      punchesByEmp.get(p.employeeId)!.push(p);
    }

    const records: ShiftWiseAttendanceRecord[] = [];

    for (const emp of employees) {
      const resolved = await this.resolveShiftForEmployeeDate(
        emp.id,
        dateStr,
        emp.shift,
        assignments,
        shiftsMap
      );

      const shift = resolved.shift;
      const isNightShift = shift.isNightShift;
      const expectedHours = shift.expectedWorkingHours;
      const isWeeklyOff = resolved.isWeeklyOff;
      const isLeave = leaveMap.has(emp.id);

      // Determine punches for this shift
      const empPunches = punchesByEmp.get(emp.id) || [];
      // If day shift: filter punches on the same day dateStr
      // If night shift: check-in is on dateStr (e.g. 21:00-23:59), check-out is next morning (e.g. 05:00-09:00)
      let checkInDate: Date | null = null;
      let checkOutDate: Date | null = null;

      if (isNightShift) {
        const checkIns = empPunches.filter(p => {
          const pDate = p.punchTime.toISOString().split('T')[0];
          return pDate === dateStr;
        });
        const checkOuts = empPunches.filter(p => {
          const pDate = p.punchTime.toISOString().split('T')[0];
          return pDate === nextDayStr;
        });

        if (checkIns.length > 0) checkInDate = checkIns[0].punchTime;
        if (checkOuts.length > 0) checkOutDate = checkOuts[checkOuts.length - 1].punchTime;
        else if (checkIns.length > 1) checkOutDate = checkIns[checkIns.length - 1].punchTime;
      } else {
        const dayPunches = empPunches.filter(p => p.punchTime.toISOString().split('T')[0] === dateStr);
        if (dayPunches.length > 0) {
          checkInDate = dayPunches[0].punchTime;
          if (dayPunches.length > 1) {
            checkOutDate = dayPunches[dayPunches.length - 1].punchTime;
          }
        }
      }

      // Check existing attendance table record for manual corrections / synced values
      const att = attMap.get(emp.id);
      if (att && att.checkIn && !checkInDate) checkInDate = new Date(att.checkIn);
      if (att && att.checkOut && !checkOutDate) checkOutDate = new Date(att.checkOut);

      // Working Hours calculation (deduct break duration)
      let grossDurationHours = 0;
      let workingHours = 0;
      if (checkInDate && checkOutDate) {
        grossDurationHours = (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600);
        const breakHours = (shift.breakMinutes || 0) / 60;
        workingHours = Number(Math.max(0, grossDurationHours - breakHours).toFixed(2));
      } else if (att?.workingHours) {
        workingHours = Number(att.workingHours);
      }

      // Late arrival calculation based on shift startTime + gracePeriodMinutes
      let lateMinutes = 0;
      if (checkInDate) {
        const [sh, sm] = shift.startTime.split(':').map(Number);
        const expectedStart = new Date(checkInDate);
        expectedStart.setUTCHours(sh, sm, 0, 0);

        const graceEnd = new Date(expectedStart.getTime() + shift.gracePeriodMinutes * 60000);
        if (checkInDate.getTime() > graceEnd.getTime()) {
          lateMinutes = Math.round((checkInDate.getTime() - expectedStart.getTime()) / 60000);
        }
      }

      // Determine attendance status
      let status = 'ABSENT';
      if (isLeave) {
        status = 'ON_LEAVE';
      } else if (isWeeklyOff && !checkInDate) {
        status = 'WEEK_OFF';
      } else if (holiday && !checkInDate) {
        status = 'HOLIDAY';
      } else if (checkInDate) {
        if (lateMinutes > 0) status = 'LATE';
        else status = 'PRESENT';

        if (workingHours > 0 && workingHours < (expectedHours / 2)) {
          status = 'HALF_DAY';
        }
      }

      // Calculate Overtime & Incomplete Hours
      let overtimeHours = 0;
      let incompleteHours = 0;

      if (!isLeave && !holiday && status !== 'WEEK_OFF') {
        if (workingHours > expectedHours) {
          overtimeHours = Number((workingHours - expectedHours).toFixed(2));
        } else if (workingHours < expectedHours && checkInDate && checkOutDate) {
          incompleteHours = Number((expectedHours - workingHours).toFixed(2));
        } else if (!checkInDate) {
          incompleteHours = expectedHours; // full day shortfall if unapproved absent
        }
      } else if (isWeeklyOff && workingHours > 0) {
        // Worked on weekly off -> full duration counts as overtime
        overtimeHours = workingHours;
      }

      records.push({
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        employeeCode: emp.employeeId,
        department: emp.department?.name || 'General',
        date: dateStr,
        shift: {
          id: shift.id,
          name: shift.name,
          code: shift.code,
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakMinutes: shift.breakMinutes,
          weeklyOff: shift.weeklyOff,
          isNightShift: shift.isNightShift,
          expectedWorkingHours: expectedHours
        },
        checkIn: checkInDate ? checkInDate.toISOString() : null,
        checkOut: checkOutDate ? checkOutDate.toISOString() : null,
        workingHours,
        expectedHours: (isLeave || isWeeklyOff || holiday) ? 0 : expectedHours,
        lateMinutes,
        incompleteHours,
        overtimeHours,
        status,
        isWeeklyOff,
        isOvernight: isNightShift
      });
    }

    return {
      date: dateStr,
      totalEmployees: employees.length,
      records
    };
  }
}

export const shiftService = new ShiftService();
