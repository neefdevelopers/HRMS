import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, enforceBrandAccess, Role } from '../middleware/rbac.js';
import {
  getExitDashboard,
  submitResignation,
  approveResignation,
  rejectResignation,
  updateLastWorkingDay,
  withdrawResignation,
  updateChecklist,
  getEmployeeAssets,
  clearAsset,
  toggleManualAssetClearance,
  previewRelievingLetter,
  issueRelievingLetter,
  downloadRelievingLetterPdf,
  completeExit
} from '../controllers/exitController.js';

const router = Router();

// All exit management routes require authentication
router.use(authenticate);

// 1. Dashboard metrics and exit request list
router.get('/dashboard', enforceBrandAccess, getExitDashboard);

// 2. Resignation submission (Employee can submit own; HR can submit on behalf)
router.post('/submit', enforceBrandAccess, submitResignation);

// 3. Resignation approval & rejection (HR & Admin only)
router.post(
  '/:id/approve',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  approveResignation
);

router.post(
  '/:id/reject',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  rejectResignation
);

// 4. Update last working day (HR & Admin only)
router.patch(
  '/:id/last-working-day',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  updateLastWorkingDay
);

// 5. Withdraw resignation (Employee own or HR)
router.post('/:id/withdraw', withdrawResignation);

// 6. Exit Checklist (HR & Admin)
router.put(
  '/:id/checklist',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  updateChecklist
);

// 7. Asset Return Clearance (HR, Admin, or Manager)
router.get('/:id/assets', getEmployeeAssets);

router.post(
  '/:id/assets/:assetId/clear',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER),
  clearAsset
);

router.post(
  '/:id/assets/manual-clear',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER),
  toggleManualAssetClearance
);

// 8. Relieving Letter Preview, Issuing & PDF Download
router.get(
  '/:id/relieving-letter/preview',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  previewRelievingLetter
);

router.post(
  '/:id/relieving-letter/issue',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  issueRelievingLetter
);

router.get('/:id/relieving-letter/pdf', downloadRelievingLetterPdf);

// 9. Final Exit Completion (HR & Admin only)
router.post(
  '/:id/complete',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  completeExit
);

export default router;
