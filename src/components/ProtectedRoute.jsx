import { Navigate, useLocation } from 'react-router-dom';
import { homePath, useAuth } from '../lib/auth';
function AuthSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <span
        className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent"
        aria-hidden
      />
    </div>
  );
}
/** Only renders children for an authenticated user with the given role. */
export default function ProtectedRoute({ role, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <AuthSplash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={homePath(user.role)} replace />;
  return <>{children}</>;
}
/** Redirects authenticated users away from guest-only pages (login / register). */
export function GuestOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <AuthSplash />;
  if (user) return <Navigate to={homePath(user.role)} replace />;
  return <>{children}</>;
}
