import { Router } from 'express';
import { getDashboardMetrics } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/auth.js';
import { enforceBrandAccess } from '../middleware/rbac.js';

const router = Router();

router.use(authenticate);

// Main real-time HR Dashboard aggregation API endpoint
router.get('/metrics', enforceBrandAccess, getDashboardMetrics);

export default router;
