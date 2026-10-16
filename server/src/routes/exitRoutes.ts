import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, enforceBrandAccess, enforceCompanyAccess, Role } from '../middleware/rbac.js';
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

// All exit management routes require authentication and company context
router.use(authenticate);
router.use(enforceCompanyAccess);
router.use(authorizeRoles(Role.ADMIN, Role.HR));

// 1. Dashboard metrics and exit request list
router.get(
  '/dashboard',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  getExitDashboard
);

// 2. Resignation submission (HR workflow on behalf of employee)
router.post(
  '/submit',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  submitResignation
);

// 3. Resignation approval & rejection (HR & Admin only)
router.post(
  '/:id/approve',
  authorizeRoles(Role.ADMIN, Role.HR),
  approveResignation
);

router.post(
  '/:id/reject',
  authorizeRoles(Role.ADMIN, Role.HR),
  rejectResignation
);

// 4. Update last working day (HR & Admin only)
router.patch(
  '/:id/last-working-day',
  authorizeRoles(Role.ADMIN, Role.HR),
  updateLastWorkingDay
);

// 5. Withdraw resignation (HR & Admin only)
router.post(
  '/:id/withdraw',
  authorizeRoles(Role.ADMIN, Role.HR),
  withdrawResignation
);

// 6. Exit Checklist (HR & Admin)
router.put(
  '/:id/checklist',
  authorizeRoles(Role.ADMIN, Role.HR),
  updateChecklist
);

// 7. Asset Return Clearance (HR & Admin)
router.get(
  '/:id/assets',
  authorizeRoles(Role.ADMIN, Role.HR),
  getEmployeeAssets
);

router.post(
  '/:id/assets/:assetId/clear',
  authorizeRoles(Role.ADMIN, Role.HR),
  clearAsset
);

router.post(
  '/:id/assets/manual-clear',
  authorizeRoles(Role.ADMIN, Role.HR),
  toggleManualAssetClearance
);

// 8. Relieving Letter Preview, Issuing & PDF Download
router.get(
  '/:id/relieving-letter/preview',
  authorizeRoles(Role.ADMIN, Role.HR),
  previewRelievingLetter
);

router.post(
  '/:id/relieving-letter/issue',
  authorizeRoles(Role.ADMIN, Role.HR),
  issueRelievingLetter
);

router.get(
  '/:id/relieving-letter/pdf',
  authorizeRoles(Role.ADMIN, Role.HR),
  downloadRelievingLetterPdf
);

// 9. Final Exit Completion (HR & Admin only)
router.post(
  '/:id/complete',
  authorizeRoles(Role.ADMIN, Role.HR),
  completeExit
);

export default router;
