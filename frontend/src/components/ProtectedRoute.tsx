import { Navigate } from "react-router-dom";

interface Props {
  children: JSX.Element;
  role: "admin" | "user";
}

const ProtectedRoute = ({ children, role }: Props) => {
  const isAuth = localStorage.getItem("isAuthenticated");
  const userRole = localStorage.getItem("userRole"); // 👈 SAME KEY

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  if (role !== userRole) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
