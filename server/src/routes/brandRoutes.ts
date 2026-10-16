import { Router } from 'express';
import {
  getBrands,
  getBrandById,
  createBrand,
  updateBrand,
  toggleBrandStatus,
  getBranches,
  getDepartments,
  getDesignations,
  getShifts
} from '../controllers/brandController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, enforceBrandAccess, enforceCompanyAccess, Role } from '../middleware/rbac.js';

const router = Router();

router.use(authenticate);
router.use(enforceCompanyAccess);

router.get('/', enforceBrandAccess, getBrands);
router.get('/branches', enforceBrandAccess, getBranches);
router.get('/departments', authorizeRoles(Role.ADMIN, Role.HR), enforceBrandAccess, getDepartments);
router.get('/designations', authorizeRoles(Role.ADMIN, Role.HR), enforceBrandAccess, getDesignations);
router.get('/shifts', authorizeRoles(Role.ADMIN, Role.HR), enforceBrandAccess, getShifts);

router.get('/:id', authorizeRoles(Role.ADMIN, Role.HR), getBrandById);

// Brand creation, update, and status toggle are strictly restricted to Super Admin, Company Admin, and Company HR.
// Brand HR and lower roles are NOT permitted to manage brands.
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
