import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { MainLayout } from './components/Layout/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { UploadPage } from './pages/UploadPage';
import { MyRequestsPage } from './pages/MyRequestsPage';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { AgentConfigPage } from './pages/AgentConfigPage';
import { PolicyManagementPage } from './pages/PolicyManagementPage';
import { ReviewExecutePage } from './pages/ReviewExecutePage';
import { ReviewResultsPage } from './pages/ReviewResultsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function AppRoutes() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <MainLayout
              isAuthenticated={isAuthenticated}
              userGroup={user?.group || null}
              userEmail={user?.email}
              onLogout={logout}
            />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/my-requests" element={<MyRequestsPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/admin/agents" element={<AgentConfigPage />} />
        <Route path="/admin/policies" element={<PolicyManagementPage />} />
        <Route path="/reviews/:id/execute" element={<ReviewExecutePage />} />
        <Route path="/reviews/:executionId/results" element={<ReviewResultsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
