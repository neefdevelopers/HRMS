import { Router } from 'express';
import {
  getEmployees,
  getEmployeeById,
  getEmployeeCompleteProfile,
  getEmployeeDocuments,
  uploadEmployeeDocument,
  deleteEmployeeDocument,
  createEmployee,
  updateEmployee
} from '../controllers/employeeController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, enforceBrandAccess, Role } from '../middleware/rbac.js';

const router = Router();

router.use(authenticate);

// List & Profile
router.get('/', enforceBrandAccess, getEmployees);
router.get('/:id/profile', getEmployeeCompleteProfile);
router.get('/:id', getEmployeeById);

// Document Management
router.get('/:id/documents', getEmployeeDocuments);
router.post(
  '/:id/documents',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  uploadEmployeeDocument
);
router.delete(
  '/:id/documents/:docId',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  deleteEmployeeDocument
);

// Employee CRUD
router.post('/', authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR), createEmployee);
router.put('/:id', authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR), updateEmployee);
router.patch('/:id', authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR), updateEmployee);

export default router;
