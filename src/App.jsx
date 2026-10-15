import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { StoreProvider, useStore } from './lib/store';
import { AuthProvider } from './lib/auth';
import { Logo } from './components/Layout';
import { ToastProvider } from './components/ui';
import ProtectedRoute, { GuestOnly } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import NotificationsPage from './pages/shared/NotificationsPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminResidents from './pages/admin/AdminResidents';
import AdminCollectors from './pages/admin/AdminCollectors';
import AdminReports from './pages/admin/AdminReports';
import AdminSchedules from './pages/admin/AdminSchedules';
import AdminRoutes from './pages/admin/AdminRoutes';
import AdminTrucks from './pages/admin/AdminTrucks';
import AdminGps from './pages/admin/AdminGps';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminIssues from './pages/admin/AdminIssues';
import AdminActivity from './pages/admin/AdminActivity';
import {
  ResidentDashboard,
  ResidentSchedule,
  ResidentReport,
  ResidentMyReports,
  ResidentProfile,
} from './pages/resident/ResidentPages';
import ResidentTracking from './pages/resident/ResidentTracking';
import {
  CollectorDashboard,
  CollectorCollections,
  CollectorAddReport,
  CollectorProfile,
} from './pages/collector/CollectorPages';
import AssignedReports from './pages/collector/AssignedReports';
function LoadingGate({ children }) {
  const { loaded } = useStore();
  if (loaded) return <>{children}</>;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50">
      <Logo />
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent"
          aria-hidden
        />
        Loading EcoRescue…
      </div>
    </div>
  );
}
export default function App() {
  return (
    <StoreProvider>
      <LoadingGate>
        <AuthProvider>
          <ToastProvider>
            <HashRouter>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route
                  path="/register"
                  element={
                    <GuestOnly>
                      <Register />
                    </GuestOnly>
                  }
                />

                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute role="admin">
                      <Layout role="admin" />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AdminDashboard />} />
                  <Route path="residents" element={<AdminResidents />} />
                  <Route path="reports" element={<AdminReports />} />
                  <Route path="schedules" element={<AdminSchedules />} />
                  <Route path="notifications" element={<AdminNotifications />} />
                  <Route path="announcements" element={<AdminAnnouncements />} />
                  <Route path="collectors" element={<AdminCollectors />} />
                  <Route path="trucks" element={<AdminTrucks />} />
                  <Route path="issues" element={<AdminIssues />} />
                  <Route path="routes" element={<AdminRoutes />} />
                  <Route path="map" element={<AdminGps />} />
                  <Route path="activity" element={<AdminActivity />} />
                </Route>

                <Route
                  path="/resident"
                  element={
                    <ProtectedRoute role="resident">
                      <Layout role="resident" />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<ResidentDashboard />} />
                  <Route path="schedule" element={<ResidentSchedule />} />
                  <Route path="tracking" element={<ResidentTracking />} />
                  <Route path="report" element={<ResidentReport />} />
                  <Route path="my-reports" element={<ResidentMyReports />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="profile" element={<ResidentProfile />} />
                </Route>

                <Route
                  path="/collector"
                  element={
                    <ProtectedRoute role="collector">
                      <Layout role="collector" />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<CollectorDashboard />} />
                  <Route path="collections" element={<CollectorCollections />} />
                  <Route path="add-report" element={<CollectorAddReport />} />
                  <Route path="assigned" element={<AssignedReports />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="profile" element={<CollectorProfile />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </HashRouter>
          </ToastProvider>
        </AuthProvider>
      </LoadingGate>
    </StoreProvider>
  );
}
