import { Router } from 'express';
import {
  getBrands,
  getBrandById,
  createBrand,
  updateBrand,
  toggleBrandStatus,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation,
  getShifts
} from '../controllers/brandController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, enforceBrandAccess, enforceCompanyAccess, Role } from '../middleware/rbac.js';

const router = Router();

router.use(authenticate);
router.use(enforceCompanyAccess);

router.get('/', enforceBrandAccess, getBrands);

// Department endpoints
router.get('/departments', authorizeRoles(Role.ADMIN, Role.HR), enforceBrandAccess, getDepartments);
router.post('/departments', authorizeRoles(Role.ADMIN, Role.HR), createDepartment);
router.put('/departments/:id', authorizeRoles(Role.ADMIN, Role.HR), updateDepartment);
router.delete('/departments/:id', authorizeRoles(Role.ADMIN, Role.HR), deleteDepartment);

// Designation endpoints
router.get('/designations', authorizeRoles(Role.ADMIN, Role.HR), enforceBrandAccess, getDesignations);
router.post('/designations', authorizeRoles(Role.ADMIN, Role.HR), createDesignation);
router.put('/designations/:id', authorizeRoles(Role.ADMIN, Role.HR), updateDesignation);
router.delete('/designations/:id', authorizeRoles(Role.ADMIN, Role.HR), deleteDesignation);

// Shifts
router.get('/shifts', authorizeRoles(Role.ADMIN, Role.HR), enforceBrandAccess, getShifts);

router.get('/:id', authorizeRoles(Role.ADMIN, Role.HR), getBrandById);

// Brand creation, update, and status toggle are strictly restricted to Super Admin, Company Admin, and Company HR.
router.post(
  '/',
  authorizeRoles(Role.ADMIN, Role.HR),
  createBrand
);

router.put(
  '/:id',
  authorizeRoles(Role.ADMIN, Role.HR),
  updateBrand
);

router.patch(
  '/:id/status',
  authorizeRoles(Role.ADMIN, Role.HR),
  toggleBrandStatus
);

export default router;
