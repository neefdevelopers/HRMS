import { Router } from 'express';
import {
  getAttendance,
  syncPunches,
  manualCorrection,
  getPunches
} from '../controllers/attendanceController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, enforceBrandAccess, Role } from '../middleware/rbac.js';

const router = Router();

router.use(authenticate);

router.get('/', enforceBrandAccess, getAttendance);
router.get('/punches', enforceBrandAccess, getPunches);
router.post('/sync', authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR), syncPunches);
router.put('/:id/correct', authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR), manualCorrection);

export default router;
