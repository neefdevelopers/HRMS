import { Router } from 'express';
import {
  getBrands,
  getBrandById,
  createBrand,
  updateBrand,
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
router.post('/', authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR), createBrand);
router.put('/:id', authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR), updateBrand);

export default router;
