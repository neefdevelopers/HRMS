import { Router } from 'express';
import { assetDocumentController } from '../controllers/assetDocumentController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, enforceBrandAccess, Role } from '../middleware/rbac.js';

const router = Router();

router.use(authenticate);

// 1. Assets Routes
router.get('/assets', enforceBrandAccess, assetDocumentController.getAssets);
router.get('/assets/:id', assetDocumentController.getAssetById);

router.post(
  '/assets',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  enforceBrandAccess,
  assetDocumentController.createAsset
);

router.put(
  '/assets/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  assetDocumentController.updateAsset
);

router.delete(
  '/assets/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  assetDocumentController.deleteAsset
);

router.post(
  '/assets/:id/assign',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  assetDocumentController.assignAsset
);

router.post(
  '/assets/:id/return',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  assetDocumentController.returnAsset
);

// 2. Documents Routes
router.get('/documents', enforceBrandAccess, assetDocumentController.getDocuments);
router.get('/documents/expiry-summary', enforceBrandAccess, assetDocumentController.getExpirySummary);

router.post(
  '/documents',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  enforceBrandAccess,
  assetDocumentController.createDocument
);

router.put(
  '/documents/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  assetDocumentController.updateDocument
);

router.post(
  '/documents/:id/replace',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  assetDocumentController.replaceDocument
);

router.delete(
  '/documents/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  assetDocumentController.deleteDocument
);

router.post(
  '/documents/trigger-reminders',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  enforceBrandAccess,
  assetDocumentController.triggerExpiryReminders
);

export default router;
