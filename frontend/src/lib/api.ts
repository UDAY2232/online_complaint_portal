import axios from 'axios';

const API_BASE_URL = "https://online-complaint-backend.onrender.com";
;

export const api = {
  // Complaints
  getComplaints: () => 
    axios.get(`${API_BASE_URL}/complaints`),
  
  createComplaint: (complaint: {
    category: string;
    description: string;
    email?: string;
    name?: string;
    priority: string;
    is_anonymous: boolean;
  }) => 
    axios.post(`${API_BASE_URL}/complaints`, complaint),
  
  updateComplaintStatus: (id: number, status: string, changed_by?: string) =>
    axios.put(`${API_BASE_URL}/complaints/${id}`, { status, changed_by }),

  // Escalations
  getEscalations: () =>
    axios.get(`${API_BASE_URL}/escalations`),
  
  checkEscalations: () =>
    axios.post(`${API_BASE_URL}/complaints/check-escalations`),

  // Users
  getUserRoles: () =>
    axios.get(`${API_BASE_URL}/user-roles`),
  createUser: (user: { email: string; role?: string }) =>
    axios.post(`${API_BASE_URL}/user-roles`, user),
  updateUser: (id: number, patch: { role?: string }) =>
    axios.put(`${API_BASE_URL}/user-roles/${id}`, patch),
  // Anonymous tracking
  getTrack: (trackingId: string) =>
    axios.get(`${API_BASE_URL}/track/${trackingId}`),
  getComplaintHistory: (id: number) =>
    axios.get(`${API_BASE_URL}/complaints/${id}/history`),
};