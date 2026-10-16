import { Router } from 'express';
import { getDashboardMetrics } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, enforceBrandAccess, enforceCompanyAccess, Role } from '../middleware/rbac.js';

const router = Router();

router.use(authenticate);
router.use(enforceCompanyAccess);
router.use(authorizeRoles(Role.ADMIN, Role.HR));

// Main real-time HR Dashboard aggregation API endpoint
router.get('/metrics', enforceBrandAccess, getDashboardMetrics);

export default router;
