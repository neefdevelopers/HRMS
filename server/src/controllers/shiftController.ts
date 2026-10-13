import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { shiftService } from '../services/shiftService.js';
import { sendSuccess, sendError } from '../utils/response.js';

export class ShiftController {
  /**
   * GET /api/shifts
   * Retrieve all shifts (optionally filtered by brand)
   */
  async getShifts(req: AuthenticatedRequest, res: Response) {
    try {
      const brandId = (req.query.brandId as string) || req.effectiveBrandId || undefined;
      const shifts = await shiftService.getShifts(brandId);
      return sendSuccess(res, shifts, 'Shifts retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to retrieve shifts', 500);
    }
  }

  /**
   * POST /api/shifts
   * Create a new shift
   */
  async createShift(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, code, startTime, endTime, breakMinutes, weeklyOff, gracePeriodMinutes, isDefault } = req.body;
      const brandId = req.body.brandId || req.effectiveBrandId || req.user?.brandId;

      if (!brandId) {
        return sendError(res, 'Brand ID is required to create a shift', 400);
      }
      if (!name || !code || !startTime || !endTime) {
        return sendError(res, 'Shift name, code, start time, and end time are required', 400);
      }

      const shift = await shiftService.createShift({
        brandId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        breakMinutes: breakMinutes !== undefined ? parseInt(breakMinutes, 10) : 60,
        weeklyOff: weeklyOff || 'SUNDAY',
        gracePeriodMinutes: gracePeriodMinutes !== undefined ? parseInt(gracePeriodMinutes, 10) : 15,
        isDefault: Boolean(isDefault)
      });

      return sendSuccess(res, shift, 'Shift created successfully', 201);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to create shift', 400);
    }
  }

  /**
   * PUT /api/shifts/:id
   * Update an existing shift
   */
  async updateShift(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { name, code, startTime, endTime, breakMinutes, weeklyOff, gracePeriodMinutes, isDefault } = req.body;

      const shift = await shiftService.updateShift(id, {
        name: name?.trim(),
        code: code?.trim().toUpperCase(),
        startTime: startTime?.trim(),
        endTime: endTime?.trim(),
        breakMinutes: breakMinutes !== undefined ? parseInt(breakMinutes, 10) : undefined,
        weeklyOff,
        gracePeriodMinutes: gracePeriodMinutes !== undefined ? parseInt(gracePeriodMinutes, 10) : undefined,
        isDefault: isDefault !== undefined ? Boolean(isDefault) : undefined
      });

      return sendSuccess(res, shift, 'Shift updated successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update shift', 400);
    }
  }

  /**
   * DELETE /api/shifts/:id
   * Delete a shift
   */
  async deleteShift(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      await shiftService.deleteShift(id);
      return sendSuccess(res, null, 'Shift deleted successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to delete shift', 400);
    }
  }

  /**
   * POST /api/shifts/assign
   * Assign a shift or rotational shift sequence to employee(s)
   */
  async assignShifts(req: AuthenticatedRequest, res: Response) {
    try {
      const { employeeIds, shiftId, startDate, endDate, isRotational, rotationFrequency, rotationShiftIds, notes } = req.body;
      const brandId = req.body.brandId || req.effectiveBrandId || req.user?.brandId;

      if (!brandId) {
        return sendError(res, 'Brand ID is required', 400);
      }
      if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
        return sendError(res, 'At least one employee must be selected', 400);
      }
      if (!shiftId) {
        return sendError(res, 'Shift ID is required', 400);
      }
      if (!startDate) {
        return sendError(res, 'Assignment start date is required', 400);
      }

      const result = await shiftService.assignShifts({
        brandId,
        employeeIds,
        shiftId,
        startDate,
        endDate: endDate || undefined,
        isRotational: Boolean(isRotational),
        rotationFrequency,
        rotationShiftIds,
        notes
      });

      return sendSuccess(res, result, `Shift assigned to ${result.assignedCount} employee(s) successfully`);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to assign shifts', 400);
    }
  }

  /**
   * GET /api/shifts/assignments
   * Get shift assignments list
   */
  async getAssignments(req: AuthenticatedRequest, res: Response) {
    try {
      let brandId = (req.query.brandId as string) || req.effectiveBrandId || undefined;
      let employeeId = (req.query.employeeId as string) || undefined;

      // If logged in as regular employee, restrict strictly to their own employee ID
      if (req.user?.role === 'EMPLOYEE') {
        if (req.user.employeeId) {
          employeeId = req.user.employeeId;
        } else {
          return sendSuccess(res, [], 'No employee profile linked');
        }
      }

      const assignments = await shiftService.getAssignments(brandId, employeeId);
      return sendSuccess(res, assignments, 'Assignments retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to retrieve assignments', 500);
    }
  }

  /**
   * DELETE /api/shifts/assignments/:id
   * Delete an assignment
   */
  async deleteAssignment(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      await shiftService.deleteAssignment(id);
      return sendSuccess(res, null, 'Assignment removed successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to delete assignment', 400);
    }
  }

  /**
   * GET /api/shifts/calendar
   * Monthly roster calendar
   */
  async getShiftCalendar(req: AuthenticatedRequest, res: Response) {
    try {
      const brandId = (req.query.brandId as string) || req.effectiveBrandId || undefined;
      const period = (req.query.period as string) || new Date().toISOString().slice(0, 7); // YYYY-MM
      const search = (req.query.search as string) || undefined;

      const calendar = await shiftService.getShiftCalendar({ brandId, period, search });

      // If regular employee, filter down to their own roster row
      if (req.user?.role === 'EMPLOYEE' && req.user.employeeId) {
        calendar.roster = calendar.roster.filter(r => r.employee.id === req.user!.employeeId);
        calendar.totalEmployees = calendar.roster.length;
      }

      return sendSuccess(res, calendar, 'Shift calendar generated successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to generate shift calendar', 500);
    }
  }

  /**
   * GET /api/shifts/attendance
   * Shift-wise daily attendance
   */
  async getShiftWiseAttendance(req: AuthenticatedRequest, res: Response) {
    try {
      const brandId = (req.query.brandId as string) || req.effectiveBrandId || undefined;
      const date = (req.query.date as string) || new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const search = (req.query.search as string) || undefined;

      const attendanceData = await shiftService.getShiftWiseAttendance({ brandId, date, search });

      // If regular employee, filter down to their own record
      if (req.user?.role === 'EMPLOYEE' && req.user.employeeId) {
        attendanceData.records = attendanceData.records.filter(r => r.employeeId === req.user!.employeeId);
        attendanceData.totalEmployees = attendanceData.records.length;
      }

      return sendSuccess(res, attendanceData, 'Shift attendance records retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to retrieve shift attendance', 500);
    }
  }

  /**
   * GET /api/shifts/my-shift
   * Quick summary for logged-in employee of their current shift & weekly off
   */
  async getMyShift(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return sendError(res, 'Unauthorized', 401);

      if (!req.user.employeeId) {
        return sendError(res, 'No employee record linked to user account', 404);
      }

      const { prisma } = await import('../config/prisma.js');
      const emp = await prisma.employee.findUnique({
        where: { id: req.user.employeeId },
        include: { shift: true }
      });

      if (!emp) {
        return sendError(res, 'Employee record not found for logged in user', 404);
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const resolved = await shiftService.resolveShiftForEmployeeDate(emp.id, todayStr, emp.shift);

      return sendSuccess(res, {
        employee: {
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
          code: emp.employeeId
        },
        todayDate: todayStr,
        currentShift: resolved.shift,
        isWeeklyOffToday: resolved.isWeeklyOff,
        isRotational: resolved.isRotational
      }, 'Employee shift details retrieved');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to get employee shift details', 500);
    }
  }
}

export const shiftController = new ShiftController();
