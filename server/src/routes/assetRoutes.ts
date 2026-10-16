import { Router } from 'express';
import { assetDocumentController } from '../controllers/assetDocumentController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, enforceBrandAccess, enforceCompanyAccess, Role } from '../middleware/rbac.js';

const router = Router();

router.use(authenticate);
router.use(enforceCompanyAccess);
router.use(authorizeRoles(Role.ADMIN, Role.HR));

// 1. Assets Routes
router.get('/assets', enforceBrandAccess, assetDocumentController.getAssets);
router.get('/assets/:id', assetDocumentController.getAssetById);

router.post(
  '/assets',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  assetDocumentController.createAsset
);

router.put(
  '/assets/:id',
  authorizeRoles(Role.ADMIN, Role.HR),
  assetDocumentController.updateAsset
);

router.delete(
  '/assets/:id',
  authorizeRoles(Role.ADMIN, Role.HR),
  assetDocumentController.deleteAsset
);

router.post(
  '/assets/:id/assign',
  authorizeRoles(Role.ADMIN, Role.HR),
  assetDocumentController.assignAsset
);

router.post(
  '/assets/:id/return',
  authorizeRoles(Role.ADMIN, Role.HR),
  assetDocumentController.returnAsset
);

// 2. Documents Routes
router.get('/documents', enforceBrandAccess, assetDocumentController.getDocuments);
router.get('/documents/expiry-summary', enforceBrandAccess, assetDocumentController.getExpirySummary);

router.post(
  '/documents',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  assetDocumentController.createDocument
);

router.put(
  '/documents/:id',
  authorizeRoles(Role.ADMIN, Role.HR),
  assetDocumentController.updateDocument
);

router.post(
  '/documents/:id/replace',
  authorizeRoles(Role.ADMIN, Role.HR),
  assetDocumentController.replaceDocument
);

router.delete(
  '/documents/:id',
  authorizeRoles(Role.ADMIN, Role.HR),
  assetDocumentController.deleteDocument
);

router.post(
  '/documents/trigger-reminders',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  assetDocumentController.triggerExpiryReminders
);

export default router;
