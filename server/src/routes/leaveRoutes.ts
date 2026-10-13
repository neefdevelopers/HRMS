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
import { authorizeRoles, enforceBrandAccess, Role } from '../middleware/rbac.js';

const router = Router();

router.use(authenticate);

router.get('/types', enforceBrandAccess, getLeaveTypes);
router.get('/balances', getLeaveBalances);
router.get('/requests', enforceBrandAccess, getLeaveRequests);
router.post('/apply', applyLeave);
router.post('/add', applyLeave);
router.delete('/requests/:id', deleteLeave);
router.delete('/:id', deleteLeave);
router.post('/requests/:id/review', authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER), reviewLeave);

export default router;
