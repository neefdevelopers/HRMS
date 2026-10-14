import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { exitService } from '../services/exitService.js';

export const getExitDashboard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { brandId, status, search } = req.query;
    const effectiveBrandId = req.effectiveBrandId !== undefined ? req.effectiveBrandId : (brandId as string);

    const result = await exitService.getDashboard(
      {
        brandId: effectiveBrandId,
        status: status as string,
        search: search as string
      },
      req.user
    );

    return sendSuccess(res, result, 'Exit dashboard data retrieved successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch exit dashboard', 500);
  }
};

export const submitResignation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employeeId, resignationDate, reason, proposedLastWorkingDay, employeeRemarks } = req.body;

    if (!reason || !reason.trim()) {
      return sendError(res, 'Resignation reason is required', 400);
    }

    const result = await exitService.submitResignation(
      {
        employeeId,
        resignationDate,
        reason,
        proposedLastWorkingDay,
        employeeRemarks
      },
      req.user
    );

    return sendSuccess(res, result, 'Resignation submitted successfully', undefined, 201);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to submit resignation', 400);
  }
};

export const approveResignation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { hrRemarks, confirmedLastWorkingDay } = req.body;

    const result = await exitService.approveResignation(id, { hrRemarks, confirmedLastWorkingDay }, req.user);
    return sendSuccess(res, result, 'Resignation approved successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to approve resignation', 400);
  }
};

export const rejectResignation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { hrRemarks } = req.body;

    if (!hrRemarks || !hrRemarks.trim()) {
      return sendError(res, 'Rejection remarks are required', 400);
    }

    const result = await exitService.rejectResignation(id, hrRemarks, req.user);
    return sendSuccess(res, result, 'Resignation rejected');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to reject resignation', 400);
  }
};

export const updateLastWorkingDay = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { lastWorkingDay, hrRemarks } = req.body;

    if (!lastWorkingDay) {
      return sendError(res, 'Last working day is required', 400);
    }

    const result = await exitService.updateLastWorkingDay(id, { lastWorkingDay, hrRemarks }, req.user);
    return sendSuccess(res, result, 'Last working day updated successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to update last working day', 400);
  }
};

export const withdrawResignation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return sendError(res, 'Withdrawal reason is required', 400);
    }

    const result = await exitService.withdrawResignation(id, reason, req.user);
    return sendSuccess(res, result, 'Resignation withdrawn successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to withdraw resignation', 400);
  }
};

export const updateChecklist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { handoverCompleted, tasksHandedOver, docsHandedOver, hrClearanceCompleted, checklistNotes } = req.body;

    const result = await exitService.updateChecklist(
      id,
      {
        handoverCompleted,
        tasksHandedOver,
        docsHandedOver,
        hrClearanceCompleted,
        checklistNotes
      },
      req.user
    );

    return sendSuccess(res, result, 'Exit checklist updated successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to update exit checklist', 400);
  }
};

export const getEmployeeAssets = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await exitService.getEmployeeAssets(id);
    return sendSuccess(res, result, 'Employee assets retrieved successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to get employee assets', 400);
  }
};

export const clearAsset = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, assetId } = req.params;
    const { action, notes } = req.body;

    if (!action || !['RETURNED', 'DAMAGED'].includes(action)) {
      return sendError(res, "Action must be 'RETURNED' or 'DAMAGED'", 400);
    }

    const result = await exitService.clearAsset(id, assetId, action, notes, req.user);
    return sendSuccess(res, result, `Asset marked as ${action} successfully`);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to clear asset', 400);
  }
};

export const toggleManualAssetClearance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { completed, notes } = req.body;

    const result = await exitService.toggleManualAssetClearance(id, Boolean(completed), notes, req.user);
    return sendSuccess(res, result, 'Asset clearance status updated successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to update asset clearance', 400);
  }
};

export const previewRelievingLetter = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const preview = await exitService.previewRelievingLetter(id);
    return sendSuccess(res, preview, 'Relieving letter preview generated');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to preview relieving letter', 400);
  }
};

export const issueRelievingLetter = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await exitService.issueRelievingLetter(id, req.user);
    return sendSuccess(res, result, 'Relieving letter issued and stored in documents successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to issue relieving letter', 400);
  }
};

export const downloadRelievingLetterPdf = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const buffer = await exitService.getRelievingLetterPdfBuffer(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Relieving_Letter_${id}.pdf`);
    return res.send(buffer);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to generate relieving letter PDF', 500);
  }
};

export const completeExit = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await exitService.completeExit(id, req.user);
    return sendSuccess(res, result, 'Exit completed successfully. Employee status marked as Inactive.');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to complete exit', 400);
  }
};
