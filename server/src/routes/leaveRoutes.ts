import { Router } from 'express';
import {
  getLeaveTypes,
  getLeaveBalances,
  getLeaveRequests,
  applyLeave,
  deleteLeave,
  reviewLeave
} from '../controllers/leaveController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, enforceBrandAccess, enforceCompanyAccess, Role } from '../middleware/rbac.js';

const router = Router();

router.use(authenticate);
router.use(enforceCompanyAccess);
router.use(authorizeRoles(Role.ADMIN, Role.HR));

router.get('/types', enforceBrandAccess, getLeaveTypes);
router.get('/balances', getLeaveBalances);
router.get('/requests', enforceBrandAccess, getLeaveRequests);
router.post(
  '/apply',
  authorizeRoles(Role.ADMIN, Role.HR),
  applyLeave
);
router.post(
  '/add',
  authorizeRoles(Role.ADMIN, Role.HR),
  applyLeave
);
router.delete(
  '/requests/:id',
  authorizeRoles(Role.ADMIN, Role.HR),
  deleteLeave
);
router.delete(
  '/:id',
  authorizeRoles(Role.ADMIN, Role.HR),
  deleteLeave
);
router.post(
  '/requests/:id/review',
  authorizeRoles(Role.ADMIN, Role.HR),
  reviewLeave
);

export default router;
