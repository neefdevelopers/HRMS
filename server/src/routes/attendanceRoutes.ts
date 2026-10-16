import { Router } from 'express';
import {
  getAttendance,
  syncPunches,
  manualCorrection,
  getPunches,
  getDailyLeaves
} from '../controllers/attendanceController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, enforceBrandAccess, enforceCompanyAccess, Role } from '../middleware/rbac.js';

const router = Router();

router.use(authenticate);
router.use(enforceCompanyAccess);
router.use(authorizeRoles(Role.ADMIN, Role.HR, Role.ATTENDANCE_VIEWER));

router.get('/', enforceBrandAccess, getAttendance);
router.get('/punches', enforceBrandAccess, getPunches);
router.get('/daily-leaves', enforceBrandAccess, getDailyLeaves);
router.post(
  '/sync',
  authorizeRoles(Role.ADMIN, Role.HR),
  syncPunches
);
router.put(
  '/:id/correct',
  authorizeRoles(Role.ADMIN, Role.HR),
  manualCorrection
);

export default router;
