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
import { LoginPage } from './pages/LoginPage';

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
                <Route index element={<DashboardPage />} />
                <Route path="companies" element={<CompaniesPage />} />
                <Route path="employees" element={<EmployeesPage />} />
                <Route path="employees/:id" element={<EmployeesPage />} />
                <Route path="attendance" element={<AttendancePage />} />
                <Route path="shifts" element={<ShiftPage />} />
                <Route path="leave" element={<LeavePage />} />
                <Route path="salary" element={<SalaryPage />} />
                <Route path="assets" element={<AssetsPage />} />
                <Route path="documents" element={<Navigate to="/assets" replace />} />
                <Route path="assets-documents" element={<Navigate to="/assets" replace />} />
                <Route path="exit" element={<ExitPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="brands" element={<BrandsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="settings" element={<SettingsPage />} />
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
