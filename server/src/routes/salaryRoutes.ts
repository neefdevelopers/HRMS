import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, enforceBrandAccess, Role } from '../middleware/rbac.js';
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
  sendSalaryReceiptMailHandler
} from '../controllers/salaryController.js';

const router = Router();

// All salary routes require authentication
router.use(authenticate);

// 0. Simplified Salary Module Core Routes
router.get(
  '/overview',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER, Role.EMPLOYEE),
  enforceBrandAccess,
  getSalaryOverview
);

router.post(
  '/calculate-single',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  enforceBrandAccess,
  calculateSingleSalary
);

// 1. Employee self-service
router.get('/my-receipts', getMyReceipts);
router.get('/my-receipts/:id/pdf', downloadReceiptPdf);

// 2. Dashboard
router.get(
  '/dashboard',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER),
  enforceBrandAccess,
  getSalaryDashboard
);

// 3. Configurations
router.get(
  '/configs',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  enforceBrandAccess,
  getSalaryConfigs
);

router.get(
  '/configs/:employeeId',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER, Role.EMPLOYEE),
  getEmployeeSalaryConfigHistory
);

router.post(
  '/configs',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  enforceBrandAccess,
  saveSalaryConfig
);

// 4. Incentives & Adjustments
router.get(
  '/incentives',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER),
  enforceBrandAccess,
  getIncentives
);

router.post(
  '/incentives',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER),
  createIncentive
);

router.patch(
  '/incentives/:id/status',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  updateIncentiveStatus
);

router.get(
  '/adjustments',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  enforceBrandAccess,
  getAdjustments
);

router.post(
  '/adjustments',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  createAdjustment
);

// 5. Overtime Management & Calculation
router.get(
  '/overtime',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER, Role.EMPLOYEE),
  enforceBrandAccess,
  getOvertimeRecords
);

router.post(
  '/overtime',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER, Role.EMPLOYEE),
  createOvertimeRecord
);

router.patch(
  '/overtime/:id/status',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  updateOvertimeStatus
);

// 6. Monthly Salary Processing
router.post(
  '/process',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  enforceBrandAccess,
  processMonthlySalary
);

router.get(
  '/payrolls',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER),
  enforceBrandAccess,
  getPayrolls
);

router.get(
  '/payrolls/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER, Role.EMPLOYEE),
  getPayrollById
);

router.patch(
  '/payrolls/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  updatePayrollReview
);

router.post(
  '/finalize',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR),
  enforceBrandAccess,
  finalizePayroll
);

// 6. Receipts & PDF Generation
router.get(
  '/receipts',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER),
  enforceBrandAccess,
  getReceipts
);

router.get(
  '/receipts/:id',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER, Role.EMPLOYEE),
  getReceiptById
);

router.get(
  '/receipts/:id/pdf',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER, Role.EMPLOYEE),
  downloadReceiptPdf
);

router.post(
  '/send-receipt-mail',
  authorizeRoles(Role.SUPER_ADMIN, Role.GROUP_HR, Role.BRAND_HR, Role.MANAGER),
  sendSalaryReceiptMailHandler
);

export default router;
