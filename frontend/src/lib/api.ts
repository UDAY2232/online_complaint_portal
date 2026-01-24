import axios from "axios";

// Production URL for Render deployment
// const API_BASE_URL = "http://localhost:4000/api";
const API_BASE_URL = "https://online-complaint-backend.onrender.com/api";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
});

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
    axiosInstance.post("/complaints", formData),

  updateComplaintStatus: (id: number, status: string, changed_by?: string) =>
    axiosInstance.put(`/complaints/${id}`, {
      status,
      changed_by,
    }),

  // 🔥 RESOLVE COMPLAINT (ADMIN - WITH IMAGE)
  resolveComplaint: (id: number, formData: FormData) =>
    axiosInstance.post(`/complaints/${id}/resolve`, formData),

  // ================= ESCALATIONS =================
  getEscalations: () =>
    axiosInstance.get("/escalations"),

  checkEscalations: () =>
    axiosInstance.post("/complaints/check-escalations"),

  // ================= USER ROLES (Admin) =================
  getUserRoles: () =>
    axiosInstance.get("/admin/users"),

  createUser: (user: { email: string; role?: string }) =>
    axiosInstance.post("/admin/users", user),

  updateUser: (id: number, patch: { role?: string }) =>
    axiosInstance.put(`/admin/users/${id}/role`, patch),

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
