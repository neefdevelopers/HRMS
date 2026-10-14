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

    let isRead: boolean | undefined = undefined;
    if (req.query.isRead === 'true') isRead = true;
    if (req.query.isRead === 'false') isRead = false;

    const result = await notificationService.getUserNotifications(req.user.id, {
      page,
      limit,
      isRead,
      type
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

    const count = await notificationService.getUnreadCount(req.user.id);
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

export const markAllAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return sendError(res, 'Unauthorized', 401);
    }

    const result = await notificationService.markAllAsRead(req.user.id);
    return sendSuccess(res, result, 'All notifications marked as read');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to mark all notifications as read', 500);
  }
};
