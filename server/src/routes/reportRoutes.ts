import { Router } from 'express';
import { getAttendanceReport, getSyncLogs } from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, enforceBrandAccess, Role } from '../middleware/rbac.js';

const router = Router();

router.use(authenticate);

router.get('/attendance', enforceBrandAccess, getAttendanceReport);
router.get('/sync-logs', authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR), getSyncLogs);

export default router;
