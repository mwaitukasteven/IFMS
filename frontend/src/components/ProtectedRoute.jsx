import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, roleHome } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles, skipPasswordCheck }) {
  const { isAuthenticated, role, mustChangePassword } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (mustChangePassword && !skipPasswordCheck && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (roles && role && !roles.includes(role)) {
    return <Navigate to={roleHome(role)} replace />;
  }

  if (roles && !role) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
