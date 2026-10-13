import { Router } from 'express';
import { shiftController } from '../controllers/shiftController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, enforceBrandAccess, Role } from '../middleware/rbac.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Quick self-check for current employee's shift
router.get('/my-shift', shiftController.getMyShift);

// Read routes
router.get('/', enforceBrandAccess, shiftController.getShifts);
router.get('/assignments', enforceBrandAccess, shiftController.getAssignments);
router.get('/calendar', enforceBrandAccess, shiftController.getShiftCalendar);
router.get('/attendance', enforceBrandAccess, shiftController.getShiftWiseAttendance);

// HR / Admin Management routes
router.post(
  '/',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER),
  enforceBrandAccess,
  shiftController.createShift
);

router.put(
  '/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER),
  shiftController.updateShift
);

router.delete(
  '/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER),
  shiftController.deleteShift
);

router.post(
  '/assign',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER),
  enforceBrandAccess,
  shiftController.assignShifts
);

router.delete(
  '/assignments/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER),
  shiftController.deleteAssignment
);

export default router;
