import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { shiftService } from '../services/shiftService.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { prisma } from '../config/prisma.js';

export class ShiftController {
  /**
   * GET /api/shifts
   * Retrieve all shifts (optionally filtered by brand)
   */
  async getShifts(req: AuthenticatedRequest, res: Response) {
    try {
      const brandId = (req.query.brandId as string) || req.effectiveBrandId || undefined;
      const companyId = (req.query.companyId as string) || req.effectiveCompanyId || undefined;
      const shifts = await shiftService.getShifts(brandId, companyId);
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
      let brandId = req.body.brandId || req.effectiveBrandId || req.user?.brandId;

      if (!brandId && req.effectiveCompanyId) {
        const defaultBrand = await prisma.brand.findFirst({
          where: { companyId: req.effectiveCompanyId, isActive: true },
          select: { id: true }
        });
        if (defaultBrand) {
          brandId = defaultBrand.id;
        }
      }

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
      let brandId = req.body.brandId || req.effectiveBrandId || req.user?.brandId;

      if (!brandId && employeeIds && employeeIds.length > 0) {
        const emp = await prisma.employee.findUnique({
          where: { id: employeeIds[0] },
          select: { brandId: true }
        });
        if (emp?.brandId) {
          brandId = emp.brandId;
        }
      }

      if (!brandId && req.effectiveCompanyId) {
        const defaultBrand = await prisma.brand.findFirst({
          where: { companyId: req.effectiveCompanyId, isActive: true },
          select: { id: true }
        });
        if (defaultBrand) {
          brandId = defaultBrand.id;
        }
      }

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
      let companyId = (req.query.companyId as string) || req.effectiveCompanyId || undefined;
      let employeeId = (req.query.employeeId as string) || undefined;

      const assignments = await shiftService.getAssignments(brandId, employeeId, companyId);
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
      const companyId = (req.query.companyId as string) || req.effectiveCompanyId || undefined;
      const period = (req.query.period as string) || new Date().toISOString().slice(0, 7); // YYYY-MM
      const search = (req.query.search as string) || undefined;

      const calendar = await shiftService.getShiftCalendar({ brandId, companyId, period, search });

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
      const companyId = (req.query.companyId as string) || req.effectiveCompanyId || undefined;
      const date = (req.query.date as string) || new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const search = (req.query.search as string) || undefined;

      const attendanceData = await shiftService.getShiftWiseAttendance({ brandId, companyId, date, search });

      return sendSuccess(res, attendanceData, 'Shift attendance records retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to retrieve shift attendance', 500);
    }
  }

  /**
   * GET /api/shifts/my-shift
   * Obsolete employee self-service endpoint (explicitly denied)
   */
  async getMyShift(req: AuthenticatedRequest, res: Response) {
    return sendError(res, 'Employee self-service endpoints have been deprecated and removed. All shift schedules are managed by authorized HR and Admin personnel.', 403);
  }
}

export const shiftController = new ShiftController();
