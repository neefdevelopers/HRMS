import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, Role } from '../middleware/rbac.js';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications
} from '../controllers/notificationController.js';

const router = Router();

router.use(authenticate);
router.use(authorizeRoles(Role.ADMIN, Role.HR));

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.delete('/clear-read', clearReadNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/:id/unread', markAsUnread);
router.delete('/:id', deleteNotification);

export default router;
