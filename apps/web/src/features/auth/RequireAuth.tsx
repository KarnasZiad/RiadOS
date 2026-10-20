import { Navigate, Outlet, useLocation } from 'react-router';
import { Spinner } from '../../components/ui/feedback';
import { useAuth } from './auth-context';

export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') {
    return <Spinner label="Ouverture de la session…" />;
  }
  if (state.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
