import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider } from './context/CompanyContext';
import { BrandProvider } from './context/BrandContext';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { AttendancePage } from './pages/AttendancePage';
import { LeavePage } from './pages/LeavePage';
import { BrandsPage } from './pages/BrandsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SalaryPage } from './pages/SalaryPage';
import { ShiftPage } from './pages/ShiftPage';
import { AssetsPage } from './pages/AssetsPage';
import { AssetsDocumentsPage } from './pages/AssetsDocumentsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ExitPage } from './pages/ExitPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { HrManagementPage } from './pages/HrManagementPage';
import { LoginPage } from './pages/LoginPage';

import { AccessDenied } from './components/common/AccessDenied';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-500">Loading HRMS workspace...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const RoleGuard: React.FC<{
  allowedRoles: ('ADMIN' | 'HR' | 'ATTENDANCE_VIEWER')[];
  children: React.ReactNode;
}> = ({ allowedRoles, children }) => {
  const { user } = useAuth();
  if (!user) return null;
  if (!allowedRoles.includes(user.role)) {
    return <AccessDenied />;
  }
  return <>{children}</>;
};

const IndexRoute: React.FC = () => {
  const { isAttendanceViewer } = useAuth();
  if (isAttendanceViewer) {
    return <Navigate to="/attendance" replace />;
  }
  return <DashboardPage />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CompanyProvider>
          <BrandProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<IndexRoute />} />
                <Route
                  path="companies"
                  element={
                    <RoleGuard allowedRoles={['ADMIN']}>
                      <CompaniesPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="hr-management"
                  element={
                    <RoleGuard allowedRoles={['ADMIN']}>
                      <HrManagementPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="employees"
                  element={
                    <RoleGuard allowedRoles={['ADMIN', 'HR']}>
                      <EmployeesPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="employees/:id"
                  element={
                    <RoleGuard allowedRoles={['ADMIN', 'HR']}>
                      <EmployeesPage />
                    </RoleGuard>
                  }
                />
                <Route path="attendance" element={<AttendancePage />} />
                <Route
                  path="shifts"
                  element={
                    <RoleGuard allowedRoles={['ADMIN', 'HR']}>
                      <ShiftPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="leave"
                  element={
                    <RoleGuard allowedRoles={['ADMIN', 'HR']}>
                      <LeavePage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="salary"
                  element={
                    <RoleGuard allowedRoles={['ADMIN', 'HR']}>
                      <SalaryPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="assets"
                  element={
                    <RoleGuard allowedRoles={['ADMIN', 'HR']}>
                      <AssetsPage />
                    </RoleGuard>
                  }
                />
                <Route path="documents" element={<Navigate to="/assets" replace />} />
                <Route path="assets-documents" element={<Navigate to="/assets" replace />} />
                <Route
                  path="exit"
                  element={
                    <RoleGuard allowedRoles={['ADMIN', 'HR']}>
                      <ExitPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="notifications"
                  element={
                    <RoleGuard allowedRoles={['ADMIN', 'HR']}>
                      <NotificationsPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="brands"
                  element={
                    <RoleGuard allowedRoles={['ADMIN', 'HR']}>
                      <BrandsPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="reports"
                  element={
                    <RoleGuard allowedRoles={['ADMIN', 'HR']}>
                      <ReportsPage />
                    </RoleGuard>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <RoleGuard allowedRoles={['ADMIN', 'HR']}>
                      <SettingsPage />
                    </RoleGuard>
                  }
                />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrandProvider>
        </CompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
