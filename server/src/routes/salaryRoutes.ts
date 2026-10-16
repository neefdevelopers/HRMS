import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, enforceBrandAccess, enforceCompanyAccess, Role } from '../middleware/rbac.js';
import {
  getSalaryOverview,
  calculateSingleSalary,
  getSalaryDashboard,
  getSalaryConfigs,
  getEmployeeSalaryConfigHistory,
  saveSalaryConfig,
  getIncentives,
  createIncentive,
  updateIncentiveStatus,
  getAdjustments,
  createAdjustment,
  processMonthlySalary,
  getPayrolls,
  getPayrollById,
  updatePayrollReview,
  finalizePayroll,
  getReceipts,
  getReceiptById,
  downloadReceiptPdf,
  getMyReceipts,
  getOvertimeRecords,
  createOvertimeRecord,
  updateOvertimeStatus,
  sendSalaryReceiptMailHandler,
  prepareSalaryReceiptHandler
} from '../controllers/salaryController.js';

const router = Router();

// All salary routes require authentication and company context
router.use(authenticate);
router.use(enforceCompanyAccess);
router.use(authorizeRoles(Role.ADMIN, Role.HR));

// 0. Simplified Salary Module Core Routes
router.get(
  '/overview',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  getSalaryOverview
);

router.post(
  '/calculate-single',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  calculateSingleSalary
);

// 1. Dashboard
router.get(
  '/dashboard',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  getSalaryDashboard
);

// 2. Configurations
router.get(
  '/configs',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  getSalaryConfigs
);

router.get(
  '/configs/:employeeId',
  authorizeRoles(Role.ADMIN, Role.HR),
  getEmployeeSalaryConfigHistory
);

router.post(
  '/configs',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  saveSalaryConfig
);

// 3. Incentives & Adjustments
router.get(
  '/incentives',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  getIncentives
);

router.post(
  '/incentives',
  authorizeRoles(Role.ADMIN, Role.HR),
  createIncentive
);

router.patch(
  '/incentives/:id/status',
  authorizeRoles(Role.ADMIN, Role.HR),
  updateIncentiveStatus
);

router.get(
  '/adjustments',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  getAdjustments
);

router.post(
  '/adjustments',
  authorizeRoles(Role.ADMIN, Role.HR),
  createAdjustment
);

// 4. Overtime Management & Calculation
router.get(
  '/overtime',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  getOvertimeRecords
);

router.post(
  '/overtime',
  authorizeRoles(Role.ADMIN, Role.HR),
  createOvertimeRecord
);

router.patch(
  '/overtime/:id/status',
  authorizeRoles(Role.ADMIN, Role.HR),
  updateOvertimeStatus
);

// 5. Monthly Salary Processing
router.post(
  '/process',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  processMonthlySalary
);

router.get(
  '/payrolls',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  getPayrolls
);

router.get(
  '/payrolls/:id',
  authorizeRoles(Role.ADMIN, Role.HR),
  getPayrollById
);

router.patch(
  '/payrolls/:id',
  authorizeRoles(Role.ADMIN, Role.HR),
  updatePayrollReview
);

router.post(
  '/finalize',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  finalizePayroll
);

// 6. Receipts & PDF Generation
router.get(
  '/receipts',
  authorizeRoles(Role.ADMIN, Role.HR),
  enforceBrandAccess,
  getReceipts
);

router.get(
  '/receipts/:id',
  authorizeRoles(Role.ADMIN, Role.HR),
  getReceiptById
);

router.get(
  '/receipts/:id/pdf',
  authorizeRoles(Role.ADMIN, Role.HR),
  downloadReceiptPdf
);

router.post(
  '/send-receipt-mail',
  authorizeRoles(Role.ADMIN, Role.HR),
  sendSalaryReceiptMailHandler
);

router.post(
  '/prepare-receipt',
  authorizeRoles(Role.ADMIN, Role.HR),
  prepareSalaryReceiptHandler
);

export default router;
