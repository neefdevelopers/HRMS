import { Router } from 'express';
import {
  getCompanies,
  getCompanyById,
  getCompanyOverview,
  createCompany,
  updateCompany,
  toggleCompanyStatus,
  assignCompanyAdmin
} from '../controllers/companyController.js';
import {
  getCompanyHrUsers,
  assignCompanyHrUser,
  removeCompanyHrUser
} from '../controllers/hrManagementController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, Role } from '../middleware/rbac.js';

const router = Router();

// All company management routes require authentication and ADMIN role
router.use(authenticate);
router.use(authorizeRoles(Role.ADMIN));

router.get('/', getCompanies);
router.post('/', createCompany);
router.get('/:id', getCompanyById);
router.get('/:id/overview', getCompanyOverview);
router.put('/:id', updateCompany);
router.patch('/:id/status', toggleCompanyStatus);
router.post('/:id/admin', assignCompanyAdmin);
router.post('/:id/admins', assignCompanyAdmin);

// Per-company HR assignments
router.get('/:id/hr-users', getCompanyHrUsers);
router.post('/:id/hr-users', assignCompanyHrUser);
router.delete('/:id/hr-users/:userId', removeCompanyHrUser);

export default router;
