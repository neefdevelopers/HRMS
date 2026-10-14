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
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, Role } from '../middleware/rbac.js';

const router = Router();

// All company management routes require authentication
router.use(authenticate);

// Platform Super Admin exclusive routes
router.get('/', authorizeRoles(Role.SUPER_ADMIN), getCompanies);
router.post('/', authorizeRoles(Role.SUPER_ADMIN), createCompany);
router.get('/:id', authorizeRoles(Role.SUPER_ADMIN), getCompanyById);
router.get('/:id/overview', authorizeRoles(Role.SUPER_ADMIN), getCompanyOverview);
router.put('/:id', authorizeRoles(Role.SUPER_ADMIN), updateCompany);
router.patch('/:id/status', authorizeRoles(Role.SUPER_ADMIN), toggleCompanyStatus);
router.post('/:id/admin', authorizeRoles(Role.SUPER_ADMIN), assignCompanyAdmin);
router.post('/:id/admins', authorizeRoles(Role.SUPER_ADMIN), assignCompanyAdmin);

export default router;
