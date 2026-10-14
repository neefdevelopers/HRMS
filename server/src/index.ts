import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { ENV } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import brandRoutes from './routes/brandRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import leaveRoutes from './routes/leaveRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import salaryRoutes from './routes/salaryRoutes.js';
import shiftRoutes from './routes/shiftRoutes.js';
import assetRoutes from './routes/assetRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import exitRoutes from './routes/exitRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import companyRoutes from './routes/companyRoutes.js';

const app = express();

// Middlewares
app.use(cors({
  origin: '*', // Allow local frontend clients
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'HRMS API Server', timestamp: new Date().toISOString() });
});

// Mount Module Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/assets-documents', assetRoutes);
app.use('/api', assetRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/exit', exitRoutes);
app.use('/api/notifications', notificationRoutes);

// Error Handling
app.use(errorHandler);

const PORT = ENV.PORT;
app.listen(PORT, () => {
  console.log(`[HRMS API Server] running smoothly on http://localhost:${PORT}`);
});

export default app;
