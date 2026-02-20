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
  timeout: 90000, // 90 second timeout for Render free tier cold start
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
        message: 'Server is waking up, please try again',
        details: 'The backend server may be in sleep mode (Render free tier). Please wait and retry.',
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
    axiosInstance.get("/admin/complaints"),

  // ✅ Get only logged-in user's complaints (protected endpoint)
  getUserComplaints: () =>
    axiosInstance.get("/user/complaints"),

  // 🔥 CREATE COMPLAINT (WITH IMAGE) - use protected user endpoint
  createComplaint: (formData: FormData) =>
    axiosInstance.post("/user/complaints", formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        // Ensure Authorization present for multipart requests (interceptor also adds it)
        Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
      },
    }),

  // Admin: update complaint status
  updateComplaintStatus: (id: number, status: string, changed_by?: string) =>
    axiosInstance.put(`/admin/complaints/${id}/status`, {
      status,
      changed_by,
    }),

  // 🔥 RESOLVE COMPLAINT (ADMIN - WITH IMAGE)
  resolveComplaint: (id: number, formData: FormData) =>
    axiosInstance.put(`/admin/complaints/${id}/resolve`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
      },
    }),

  // ================= ESCALATIONS =================
  getEscalations: () =>
    axiosInstance.get("/escalations"),

  checkEscalations: () =>
    axiosInstance.post("/complaints/check-escalations"),

  // ================= SUPERADMIN =================
  getEscalatedComplaints: () =>
    axiosInstance.get("/superadmin/escalated-complaints"),

  getSuperadminStats: () =>
    axiosInstance.get("/superadmin/stats"),

  getAllAdmins: () =>
    axiosInstance.get("/superadmin/admins"),

  getEscalationHistory: async (params?: { limit?: number; offset?: number }) => {
    try {
      const q = params ? `?limit=${params.limit || 50}&offset=${params.offset || 0}` : '';
      const response = await axiosInstance.get(`/superadmin/escalation-history${q}`);
      const d = response.data || {};
      return {
        data: {
          success: d.success ?? true,
          history: Array.isArray(d.history) ? d.history : [],
          total: d.total ?? 0,
          limit: d.limit ?? (params?.limit ?? 50),
          offset: d.offset ?? (params?.offset ?? 0),
        },
      };
    } catch (err) {
      return Promise.reject(err);
    }
  },

  manualEscalate: (complaintId: number, reason: string) =>
    axiosInstance.post("/superadmin/escalate", { complaintId, reason }),

  assignComplaint: (complaintId: number, adminId: number) =>
    axiosInstance.post("/superadmin/assign", { complaintId, adminId }),

  updateSuperadminSettings: (settings: { email?: string; escalationThreshold?: number }) =>
    axiosInstance.put("/superadmin/settings", settings),

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

  // Profile update: backend does not provide profile update endpoint for now.
  // Persist display name locally and return a resolved promise with the updated user object.
  updateProfile: (data: { name?: string; displayName?: string }) => {
    const userName = data.name || data.displayName; 
    try {
      const response = await axiosInstance.put('/auth/profile', { name: userName });
      const user = response.data?.user || null;
      if (user) {
        if (user.name) localStorage.setItem('userName', user.name);
        if (user.email) localStorage.setItem('userEmail', user.email);
      }
      return { data: { user } };
    } catch (err) {
      return Promise.reject(err);
    }
  },

  // Get current user profile from backend (fresh data)
  getCurrentUser: () =>
    axiosInstance.get("/auth/me"),

  // Fetch fresh user profile (to sync with DB)
  fetchProfile: () =>
    axiosInstance.get("/auth/me"),

  // ================= ANONYMOUS TRACK =================
  getTrack: (trackingId: string) =>
    axiosInstance.get(`/track/${trackingId}`),

  // Complaint history endpoint is not provided by backend in current API.
  // Return a rejected promise so callers know it's unsupported.
  getComplaintHistory: (id: number) =>
    Promise.reject({ response: { data: { error: "Complaint history endpoint not available on backend" } } }),

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

  // Change password: call backend endpoint to change password
  changePassword: async (currentPassword: string, newPassword: string) => {
    try {
      const response = await axiosInstance.post('/auth/change-password', { currentPassword, newPassword });
      return response;
    } catch (err) {
      return Promise.reject(err);
    }
  },
};
