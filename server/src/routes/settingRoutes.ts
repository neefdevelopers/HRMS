import { Router } from 'express';
import { systemSettingController } from '../controllers/systemSettingController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, Role } from '../middleware/rbac.js';

const router = Router();

// Super Admin, Company Admin, and HR administrators are authorized to manage System Settings
router.use(authenticate);
router.use(authorizeRoles(Role.ADMIN, Role.HR));

// 1. Get all system settings
router.get('/', systemSettingController.getAllSettings);

// 2. Section updates
router.put('/company', systemSettingController.updateCompany);
router.put('/attendance', systemSettingController.updateAttendance);
router.put('/leave', systemSettingController.updateLeave);
router.put('/shift', systemSettingController.updateShift);
router.put('/payroll', systemSettingController.updatePayroll);
router.put('/api', systemSettingController.updateApi);

// 3. Test Connection
router.post('/test-connection', systemSettingController.testConnection);

// 4. Brand management
router.post('/brands', systemSettingController.createBrand);
router.put('/brands/:id', systemSettingController.updateBrand);

// 5. Leave types
router.post('/leave-types', systemSettingController.createLeaveType);
router.put('/leave-types/:id', systemSettingController.updateLeaveType);
router.delete('/leave-types/:id', systemSettingController.deleteLeaveType);

// 6. Devices
router.post('/devices', systemSettingController.createDevice);
router.put('/devices/:id', systemSettingController.updateDevice);
router.delete('/devices/:id', systemSettingController.deleteDevice);

export default router;
