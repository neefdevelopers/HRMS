import { Router } from 'express';
import { shiftController } from '../controllers/shiftController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, enforceBrandAccess, enforceCompanyAccess, Role } from '../middleware/rbac.js';

const router = Router();

// All routes require authentication and company context
router.use(authenticate);
router.use(enforceCompanyAccess);
router.use(authorizeRoles(Role.ADMIN, Role.HR));

// Quick self-check (deprecated, returns 403)
router.get('/my-shift', shiftController.getMyShift);

// Read routes
router.get('/', enforceBrandAccess, shiftController.getShifts);
router.get('/assignments', enforceBrandAccess, shiftController.getAssignments);
router.get('/calendar', enforceBrandAccess, shiftController.getShiftCalendar);
router.get('/attendance', enforceBrandAccess, shiftController.getShiftWiseAttendance);

// HR / Admin Management routes
router.post(
  '/',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  shiftController.createShift
);

router.put(
  '/:id',
  authorizeRoles(Role.ADMIN, Role.HR),
  shiftController.updateShift
);

router.delete(
  '/:id',
  authorizeRoles(Role.ADMIN, Role.HR),
  shiftController.deleteShift
);

router.post(
  '/assign',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  shiftController.assignShifts
);

router.delete(
  '/assignments/:id',
  authorizeRoles(Role.ADMIN, Role.HR),
  shiftController.deleteAssignment
);

export default router;
