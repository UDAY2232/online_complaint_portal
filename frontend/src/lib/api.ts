import axios, { AxiosError } from "axios";

// Use environment variable for API URL (supports both dev and production)
// In development: set VITE_API_URL in .env (e.g., http://localhost:4000/api)
// In production: set VITE_API_URL in .env.production (e.g., https://your-backend.onrender.com/api)
// Fallback to localhost for development if not set
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.MODE === 'production' 
    ? '' // Empty will cause clear error in production
    : 'http://localhost:4000/api'); // Dev fallback

if (!API_BASE_URL) {
  console.error("❌ VITE_API_URL is not set! Please configure your environment variables.");
}

console.log("🔗 API Base URL:", API_BASE_URL);
console.log("🔗 Environment:", import.meta.env.MODE);

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 second timeout for slow connections
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to classify error types for better debugging
export const classifyError = (error: AxiosError): { type: string; message: string; details: string } => {
  if (!error.response) {
    // Network error - no response received
    if (error.code === 'ERR_NETWORK') {
      return {
        type: 'NETWORK_ERROR',
        message: 'Unable to connect to server',
        details: 'Check if the backend is running and CORS is configured correctly',
      };
    }
    if (error.code === 'ECONNABORTED') {
      return {
        type: 'TIMEOUT',
        message: 'Request timed out',
        details: 'The server took too long to respond',
      };
    }
    return {
      type: 'CONNECTION_ERROR',
      message: 'Connection failed',
      details: error.message,
    };
  }
  
  // Server responded with error status
  const status = error.response.status;
  const data = error.response.data as any;
  
  if (status === 404) {
    return {
      type: 'NOT_FOUND',
      message: 'Endpoint not found (404)',
      details: `The API endpoint ${error.config?.url} does not exist. Check the route configuration.`,
    };
  }
  if (status === 401) {
    return {
      type: 'UNAUTHORIZED',
      message: data?.error || 'Invalid credentials',
      details: 'Authentication failed',
    };
  }
  if (status === 403) {
    return {
      type: 'FORBIDDEN',
      message: 'Access denied',
      details: 'You do not have permission to access this resource',
    };
  }
  if (status === 500) {
    return {
      type: 'SERVER_ERROR',
      message: 'Server error',
      details: data?.error || 'An internal server error occurred',
    };
  }
  
  return {
    type: 'API_ERROR',
    message: data?.error || `Request failed with status ${status}`,
    details: JSON.stringify(data),
  };
};

// Add auth token to all requests
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 responses (token expired)
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken } = response.data;
          localStorage.setItem("accessToken", accessToken);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - logout user
        localStorage.removeItem("isAuthenticated");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("userRole");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userName");
        localStorage.removeItem("userId");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Logout helper function
export const logout = () => {
  const refreshToken = localStorage.getItem("refreshToken");
  
  // Call logout API (best effort)
  if (refreshToken) {
    axiosInstance.post("/auth/logout", { refreshToken }).catch(() => {});
  }

  console.log("🚪 Logging out - clearing all session data");

  // ✅ CRITICAL: Clear ALL storage to prevent data leakage
  localStorage.clear();
  sessionStorage.clear();

  // Redirect to login
  window.location.href = "/login";
};

export const api = {
  // ================= COMPLAINTS =================
  // Get all complaints (admin use)
  getComplaints: () =>
    axiosInstance.get("/complaints"),

  // ✅ Get only logged-in user's complaints (protected endpoint)
  getUserComplaints: () =>
    axiosInstance.get("/user/complaints"),

  // 🔥 CREATE COMPLAINT (WITH IMAGE)
  createComplaint: (formData: FormData) =>
    axiosInstance.post("/complaints", formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),

  updateComplaintStatus: (id: number, status: string, changed_by?: string) =>
    axiosInstance.put(`/complaints/${id}`, {
      status,
      changed_by,
    }),

  // 🔥 RESOLVE COMPLAINT (ADMIN - WITH IMAGE)
  resolveComplaint: (id: number, formData: FormData) =>
    axiosInstance.post(`/complaints/${id}/resolve`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),

  // ================= ESCALATIONS =================
  getEscalations: () =>
    axiosInstance.get("/escalations"),

  checkEscalations: () =>
    axiosInstance.post("/complaints/check-escalations"),

  // ================= USER ROLES (Admin) =================
  getUserRoles: () =>
    axiosInstance.get("/admin/users"),

  createUser: (user: { email: string; password?: string; name?: string; role?: string; status?: string }) =>
    axiosInstance.post("/admin/users", user),

  // General user update using PATCH (preferred method for partial updates)
  updateUser: (id: number, patch: { role?: string; status?: string; name?: string }) =>
    axiosInstance.patch(`/admin/users/${id}`, patch),

  // Legacy PUT update (still supported)
  updateUserPut: (id: number, patch: { role?: string; status?: string; name?: string }) =>
    axiosInstance.put(`/admin/users/${id}`, patch),

  // Legacy role-only update (superadmin)
  updateUserRole: (id: number, role: string) =>
    axiosInstance.put(`/admin/users/${id}/role`, { role }),

  // Profile update (save display name to DB)
  updateProfile: (data: { name?: string; displayName?: string }) =>
    axiosInstance.put("/auth/profile", data),

  // Get current user profile from backend (fresh data)
  getCurrentUser: () =>
    axiosInstance.get("/auth/me"),

  // Fetch fresh user profile (to sync with DB)
  fetchProfile: () =>
    axiosInstance.get("/auth/me"),

  // ================= ANONYMOUS TRACK =================
  getTrack: (trackingId: string) =>
    axiosInstance.get(`/track/${trackingId}`),

  getComplaintHistory: (id: number) =>
    axiosInstance.get(`/complaints/${id}/history`),

  // ================= AUTHENTICATION =================
  login: (email: string, password: string) =>
    axiosInstance.post("/auth/login", { email, password }),

  signup: (email: string, password: string, name?: string) =>
    axiosInstance.post("/auth/signup", { email, password, name }),

  logout: (refreshToken?: string) =>
    axiosInstance.post("/auth/logout", { refreshToken }),

  refreshToken: (refreshToken: string) =>
    axiosInstance.post("/auth/refresh", { refreshToken }),

  // ================= PASSWORD RESET =================
  forgotPassword: (email: string) =>
    axiosInstance.post("/auth/forgot-password", { email }),

  verifyResetToken: (token: string) =>
    axiosInstance.get(`/auth/verify-reset-token?token=${token}`),

  resetPassword: (token: string, newPassword: string) =>
    axiosInstance.post("/auth/reset-password", { token, newPassword }),

  changePassword: (currentPassword: string, newPassword: string) =>
    axiosInstance.post("/auth/change-password", { currentPassword, newPassword }),
};
