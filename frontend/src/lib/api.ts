import axios from "axios";

// Use local backend for testing, change back to production URL before deploying
const API_BASE_URL = "http://localhost:3856/api";
// const API_BASE_URL = "https://online-complaint-backend.onrender.com/api";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
});

export const api = {
  // ================= COMPLAINTS =================
  getComplaints: () =>
    axiosInstance.get("/complaints"),

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

  // ================= USER ROLES =================
  getUserRoles: () =>
    axiosInstance.get("/user-roles"),

  createUser: (user: { email: string; role?: string }) =>
    axiosInstance.post("/user-roles", user),

  updateUser: (id: number, patch: { role?: string }) =>
    axiosInstance.put(`/user-roles/${id}`, patch),

  // ================= ANONYMOUS TRACK =================
  getTrack: (trackingId: string) =>
    axiosInstance.get(`/track/${trackingId}`),

  getComplaintHistory: (id: number) =>
    axiosInstance.get(`/complaints/${id}/history`),
};
