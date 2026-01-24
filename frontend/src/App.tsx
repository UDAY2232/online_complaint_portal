import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AnonymousComplaint from "./pages/AnonymousComplaint";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import UserDashboard from "./pages/UserDashboard";
import UserComplaints from "./pages/UserComplaints";
import UserSettings from "./pages/UserSettings";
import StatusTracker from "./pages/StatusTracker";
import AdminDashboard from "./pages/AdminDashboard";
import AdminComplaints from "./pages/AdminComplaints";
import AdminUsers from "./pages/AdminUsers";
import AdminReports from "./pages/AdminReports";
import EscalationHistory from "./pages/EscalationHistory";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/anonymous" element={<AnonymousComplaint />} />
          
          {/* User Routes */}
          <Route
            path="/user/dashboard"
            element={
              <ProtectedRoute role="user">
                <UserDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/complaints"
            element={
              <ProtectedRoute role="user">
                <UserComplaints />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/settings"
            element={
              <ProtectedRoute role="user">
                <UserSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/status"
            element={
              <ProtectedRoute role="user">
                <StatusTracker />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute role="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/complaints"
            element={
              <ProtectedRoute role="admin">
                <AdminComplaints />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute role="admin">
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute role="admin">
                <AdminReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/escalations"
            element={
              <ProtectedRoute role="admin">
                <EscalationHistory />
              </ProtectedRoute>
            }
          />
          {/* Password Reset Routes */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Legal Pages */}
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
