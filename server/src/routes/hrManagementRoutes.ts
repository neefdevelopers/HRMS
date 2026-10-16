import { Router } from 'express';
import {
  getHrUsers,
  createHrUser,
  updateHrUser,
  updateHrCompanyAssignments,
  getCompanyHrUsers,
  assignCompanyHrUser,
  removeCompanyHrUser
} from '../controllers/hrManagementController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, Role } from '../middleware/rbac.js';

const router = Router();

// All HR management operations require authentication and ADMIN role
router.use(authenticate);
router.use(authorizeRoles(Role.ADMIN));

router.get('/', getHrUsers);
router.post('/', createHrUser);
router.put('/:userId', updateHrUser);
router.put('/:userId/companies', updateHrCompanyAssignments);

// Per-company HR assignment routes
router.get('/company/:companyId', getCompanyHrUsers);
router.post('/company/:companyId', assignCompanyHrUser);
router.delete('/company/:companyId/:userId', removeCompanyHrUser);

export default router;
