import { Navigate, useLocation } from "react-router-dom";

interface ProtectedRouteProps {
  children: JSX.Element;
  role?: "user" | "admin";
}

const ProtectedRoute = ({ children, role }: ProtectedRouteProps) => {
  const location = useLocation();
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const userRole = localStorage.getItem("userRole");
  const accessToken = localStorage.getItem("accessToken");

  // Not authenticated - redirect to login
  if (!isAuthenticated || !accessToken) {
    // Clear any stale auth data
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    localStorage.removeItem("userId");
    
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (role) {
    if (role === "admin") {
      // Admin routes - only admin and superadmin can access
      if (userRole !== "admin" && userRole !== "superadmin") {
        return <Navigate to="/user/dashboard" replace />;
      }
    } else if (role === "user") {
      // User routes - users can access, but also admins (they can do everything)
      // If strict user-only routes needed, uncomment below:
      // if (userRole === "admin" || userRole === "superadmin") {
      //   return <Navigate to="/admin/dashboard" replace />;
      // }
    }
  }

  return children;
};

export default ProtectedRoute;
