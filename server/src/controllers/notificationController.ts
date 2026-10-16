import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { notificationService } from '../services/notificationService.js';

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return sendError(res, 'Unauthorized', 401);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as string;
    const search = req.query.search as string;

    // Resolve target company: query parameter takes precedence; falls back to active workspace context
    const requestedCompanyId = req.query.companyId as string | undefined;
    const companyId = requestedCompanyId !== undefined ? requestedCompanyId : req.effectiveCompanyId;

    let isRead: boolean | undefined = undefined;
    if (req.query.isRead === 'true') isRead = true;
    if (req.query.isRead === 'false') isRead = false;

    const result = await notificationService.getUserNotifications(req.user.id, {
      page,
      limit,
      isRead,
      type,
      companyId,
      search
    });

    return sendSuccess(res, result.notifications, undefined, result.pagination);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch notifications', 500);
  }
};

export const getUnreadCount = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return sendError(res, 'Unauthorized', 401);
    }

    const requestedCompanyId = req.query.companyId as string | undefined;
    const companyId = requestedCompanyId !== undefined ? requestedCompanyId : req.effectiveCompanyId;

    const count = await notificationService.getUnreadCount(req.user.id, companyId);
    return sendSuccess(res, { unreadCount: count });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to get unread count', 500);
  }
};

export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return sendError(res, 'Unauthorized', 401);
    }

    const { id } = req.params;
    const updated = await notificationService.markAsRead(id, req.user.id);
    return sendSuccess(res, updated, 'Notification marked as read');
  } catch (error: any) {
    const statusCode = error.message.includes('Access denied') ? 403 : 400;
    return sendError(res, error.message || 'Failed to mark notification as read', statusCode);
  }
};

export const markAsUnread = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return sendError(res, 'Unauthorized', 401);
    }

    const { id } = req.params;
    const updated = await notificationService.markAsUnread(id, req.user.id);
    return sendSuccess(res, updated, 'Notification marked as unread');
  } catch (error: any) {
    const statusCode = error.message.includes('Access denied') ? 403 : 400;
    return sendError(res, error.message || 'Failed to mark notification as unread', statusCode);
  }
};

export const markAllAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return sendError(res, 'Unauthorized', 401);
    }

    const requestedCompanyId = (req.query.companyId as string) || req.body?.companyId;
    const companyId = requestedCompanyId !== undefined ? requestedCompanyId : req.effectiveCompanyId;

    const result = await notificationService.markAllAsRead(req.user.id, companyId);
    return sendSuccess(res, result, 'All notifications marked as read');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to mark all notifications as read', 500);
  }
};

export const deleteNotification = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return sendError(res, 'Unauthorized', 401);
    }

    const { id } = req.params;
    await notificationService.deleteNotification(id, req.user.id);
    return sendSuccess(res, { id }, 'Notification deleted successfully');
  } catch (error: any) {
    const statusCode = error.message.includes('Access denied') ? 403 : 400;
    return sendError(res, error.message || 'Failed to delete notification', statusCode);
  }
};

export const clearReadNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return sendError(res, 'Unauthorized', 401);
    }

    const requestedCompanyId = (req.query.companyId as string) || req.body?.companyId;
    const companyId = requestedCompanyId !== undefined ? requestedCompanyId : req.effectiveCompanyId;

    const result = await notificationService.clearReadNotifications(req.user.id, companyId);
    return sendSuccess(res, result, 'Read notifications cleared successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to clear read notifications', 500);
  }
};
