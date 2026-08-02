import { Navigate, useLocation } from 'react-router-dom';

interface PrivateRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

/**
 * PrivateRoute — Guards any route requiring authentication.
 * On every render it checks localStorage for a valid token.
 * If the token is missing (e.g. after logout), it hard-redirects to /login
 * using `replace` so the browser history entry is overwritten and pressing
 * Back cannot bring the user back to the protected page.
 */
const PrivateRoute = ({ children, allowedRoles }: PrivateRouteProps) => {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (!token) {
    // Replace current history entry so Back doesn't work
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && role && !allowedRoles.map(r => r.toUpperCase()).includes(role.toUpperCase())) {
    // Authenticated but wrong role — redirect to login
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default PrivateRoute;
