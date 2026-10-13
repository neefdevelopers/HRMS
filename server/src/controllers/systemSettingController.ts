import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { systemSettingService } from '../services/systemSettingService.js';
import { sendSuccess, sendError } from '../utils/response.js';

export class SystemSettingController {
  async getAllSettings(req: AuthenticatedRequest, res: Response) {
    try {
      const settings = await systemSettingService.getAllSettings();
      return sendSuccess(res, settings, 'System settings retrieved successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to retrieve system settings', 500);
    }
  }

  async updateCompany(req: AuthenticatedRequest, res: Response) {
    try {
      const updated = await systemSettingService.updateCompanySettings(
        req.body,
        req.user?.id,
        req.ip
      );
      return sendSuccess(res, updated, 'Company settings updated successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update company settings', 400);
    }
  }

  async updateAttendance(req: AuthenticatedRequest, res: Response) {
    try {
      const updated = await systemSettingService.updateAttendanceRules(
        req.body,
        req.user?.id,
        req.ip
      );
      return sendSuccess(res, updated, 'Attendance calculation rules updated successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update attendance rules', 400);
    }
  }

  async updateLeave(req: AuthenticatedRequest, res: Response) {
    try {
      const updated = await systemSettingService.updateLeavePolicies(
        req.body,
        req.user?.id,
        req.ip
      );
      return sendSuccess(res, updated, 'Leave policies updated successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update leave policies', 400);
    }
  }

  async updateShift(req: AuthenticatedRequest, res: Response) {
    try {
      const updated = await systemSettingService.updateShiftRules(
        req.body,
        req.user?.id,
        req.ip
      );
      return sendSuccess(res, updated, 'Shift rules updated successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update shift rules', 400);
    }
  }

  async updatePayroll(req: AuthenticatedRequest, res: Response) {
    try {
      const updated = await systemSettingService.updatePayrollSettings(
        req.body,
        req.user?.id,
        req.ip
      );
      return sendSuccess(res, updated, 'Payroll settings updated successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update payroll settings', 400);
    }
  }

  async updateApi(req: AuthenticatedRequest, res: Response) {
    try {
      const updated = await systemSettingService.updateApiSettings(
        req.body,
        req.user?.id,
        req.ip
      );
      return sendSuccess(res, updated, 'API configuration updated securely');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update API settings', 400);
    }
  }

  async testConnection(req: AuthenticatedRequest, res: Response) {
    try {
      const { type, payload } = req.body;
      if (!type) return sendError(res, 'Test connection type is required', 400);

      const result = await systemSettingService.testConnection(type, payload);
      return sendSuccess(res, result, result.message);
    } catch (error: any) {
      return sendError(res, error.message || 'Connection test failed', 400);
    }
  }

  // Brand actions
  async createBrand(req: AuthenticatedRequest, res: Response) {
    try {
      const brand = await systemSettingService.createBrand(req.body, req.user?.id, req.ip);
      return sendSuccess(res, brand, 'Brand created successfully', 201);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to create brand', 400);
    }
  }

  async updateBrand(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const brand = await systemSettingService.updateBrand(id, req.body, req.user?.id, req.ip);
      return sendSuccess(res, brand, 'Brand updated successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update brand', 400);
    }
  }

  // Leave Type actions
  async createLeaveType(req: AuthenticatedRequest, res: Response) {
    try {
      const leaveType = await systemSettingService.createLeaveType(req.body, req.user?.id, req.ip);
      return sendSuccess(res, leaveType, 'Leave type created successfully', 201);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to create leave type', 400);
    }
  }

  async updateLeaveType(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updated = await systemSettingService.updateLeaveType(id, req.body, req.user?.id, req.ip);
      return sendSuccess(res, updated, 'Leave type updated successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update leave type', 400);
    }
  }

  async deleteLeaveType(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      await systemSettingService.deleteLeaveType(id, req.user?.id, req.ip);
      return sendSuccess(res, null, 'Leave type deleted successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to delete leave type', 400);
    }
  }

  // Punching Device actions
  async createDevice(req: AuthenticatedRequest, res: Response) {
    try {
      const device = await systemSettingService.createDevice(req.body, req.user?.id, req.ip);
      return sendSuccess(res, device, 'Punching device added successfully', 201);
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to add device', 400);
    }
  }

  async updateDevice(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const updated = await systemSettingService.updateDevice(id, req.body, req.user?.id, req.ip);
      return sendSuccess(res, updated, 'Device updated successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update device', 400);
    }
  }

  async deleteDevice(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      await systemSettingService.deleteDevice(id, req.user?.id, req.ip);
      return sendSuccess(res, null, 'Device deleted successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to delete device', 400);
    }
  }
}

export const systemSettingController = new SystemSettingController();
