import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

interface ProtectedRouteProps {
  children: JSX.Element;
  role?: "user" | "admin";
}

// Helper to check if user has admin-level permissions
const isAdminRole = (role: string | null): boolean => {
  return role === "admin" || role === "superadmin";
};

// Helper to clear all auth data
const clearAuthData = () => {
  localStorage.removeItem("isAuthenticated");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("userName");
  localStorage.removeItem("userId");
};

const ProtectedRoute = ({ children, role }: ProtectedRouteProps) => {
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const userRole = localStorage.getItem("userRole");
  const accessToken = localStorage.getItem("accessToken");

  useEffect(() => {
    // Quick validation check
    setIsChecking(false);
  }, []);

  // Show nothing while checking (prevents flash)
  if (isChecking) {
    return null;
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated || !accessToken) {
    // Clear any stale auth data
    clearAuthData();
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (role) {
    if (role === "admin") {
      // Admin routes - only admin and superadmin can access
      if (!isAdminRole(userRole)) {
        console.warn("Access denied: User tried to access admin route");
        return <Navigate to="/user/dashboard" replace />;
      }
    } else if (role === "user") {
      // User routes - all authenticated users can access
      // Admins can also access user routes if needed
    }
  }

  return children;
};

export default ProtectedRoute;
