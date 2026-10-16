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
import { authorizeRoles, enforceBrandAccess, enforceCompanyAccess, Role } from '../middleware/rbac.js';

const router = Router();

router.use(authenticate);
router.use(enforceCompanyAccess);
router.use(authorizeRoles(Role.ADMIN, Role.HR));

// List & Profile
router.get('/', enforceBrandAccess, getEmployees);
router.get('/:id/profile', getEmployeeCompleteProfile);
router.get('/:id', getEmployeeById);

// Document Management
router.get('/:id/documents', getEmployeeDocuments);
router.post(
  '/:id/documents',
  authorizeRoles(Role.ADMIN, Role.HR),
  uploadEmployeeDocument
);
router.delete(
  '/:id/documents/:docId',
  authorizeRoles(Role.ADMIN, Role.HR),
  deleteEmployeeDocument
);

// Employee CRUD
router.post(
  '/',
  authorizeRoles(Role.ADMIN, Role.HR),
  createEmployee
);
router.put(
  '/:id',
  authorizeRoles(Role.ADMIN, Role.HR),
  updateEmployee
);
router.patch(
  '/:id',
  authorizeRoles(Role.ADMIN, Role.HR),
  updateEmployee
);

export default router;
