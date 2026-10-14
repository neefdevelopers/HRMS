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
import { authorizeRoles, enforceBrandAccess, Role } from '../middleware/rbac.js';

const router = Router();

router.use(authenticate);

router.get('/', enforceBrandAccess, getBrands);
router.get('/branches', enforceBrandAccess, getBranches);
router.get('/departments', enforceBrandAccess, getDepartments);
router.get('/designations', enforceBrandAccess, getDesignations);
router.get('/shifts', enforceBrandAccess, getShifts);

router.get('/:id', getBrandById);

// Brand creation, update, and status toggle are strictly restricted to Super Admin, Company Admin, and Company HR.
// Brand HR and lower roles are NOT permitted to manage brands.
router.post(
  '/',
  authorizeRoles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_HR, Role.GROUP_HR),
  createBrand
);

router.put(
  '/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_HR, Role.GROUP_HR),
  updateBrand
);

router.patch(
  '/:id/status',
  authorizeRoles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_HR, Role.GROUP_HR),
  toggleBrandStatus
);

export default router;
