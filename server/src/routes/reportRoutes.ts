import { Router } from 'express';
import { getAttendanceReport, getSyncLogs } from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, enforceBrandAccess, enforceCompanyAccess, Role } from '../middleware/rbac.js';

const router = Router();

router.use(authenticate);
router.use(enforceCompanyAccess);
router.use(authorizeRoles(Role.ADMIN, Role.HR));

router.get('/attendance', enforceBrandAccess, getAttendanceReport);
router.get(
  '/sync-logs',
  authorizeRoles(Role.ADMIN, Role.HR),
  getSyncLogs
);

export default router;
