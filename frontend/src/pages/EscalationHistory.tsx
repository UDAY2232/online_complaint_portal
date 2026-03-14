import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface EscalationRecord {
  id: number;
  complaint_id?: number;
  category?: string;
  description?: string;
  priority?: string;
  status?: string;
  email?: string;
  escalation_level?: number;
  escalated_at?: string;
  escalation_reason?: string;
  reason?: string;
  created_at?: string;
  complaint?: {
    category?: string;
    priority?: string;
    status?: string;
    description?: string;
  };
  user?: {
    email?: string;
  };
}

const EscalationHistory = () => {
  const [escalations, setEscalations] = useState<EscalationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const location = useLocation();
  const isSuperAdmin = location.pathname.startsWith('/superadmin');
  const sidebarRole = isSuperAdmin ? 'superadmin' : 'admin';

  useEffect(() => {
    fetchEscalations();
  }, []);

const fetchEscalations = async () => {
  try {
    setLoading(true);

    let history: any[] = [];
    if (isSuperAdmin) {
      const response = await api.getEscalationHistory();
      console.log("Escalation history response:", response.data);
      history = Array.isArray(response.data?.history) ? response.data.history : [];
    } else {
      const response = await api.getEscalations();
      console.log("Admin escalations response:", response.data);
      history = Array.isArray(response.data) ? response.data : [];
    }

    setEscalations(history);
  } catch (error: any) {
    console.error("Escalation history error:", error?.response?.data || error);

    toast({
      title: "Error",
      description: "Failed to load escalation history",
      variant: "destructive",
    });

    setEscalations([]);
  } finally {
    setLoading(false);
  }
};

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getEscalationBadge = (level?: number) => {
    if (!level || level <= 1) return <Badge variant="destructive">Level 1</Badge>;
    if (level === 2) return <Badge variant="destructive" className="bg-orange-600">Level 2</Badge>;
    return <Badge variant="destructive" className="bg-red-800">Level {level} - Critical</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <Sidebar role={sidebarRole} />
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Escalation History</h1>
              <p className="text-muted-foreground mt-2">
                View all complaint escalations
              </p>
            </div>

            <div className="grid gap-4">
              {loading ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Loading escalations...</p>
                  </CardContent>
                </Card>
              ) : escalations.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No escalations found.</p>
                  </CardContent>
                </Card>
              ) : (
                escalations.map((escalation, idx) => {
                  const key = escalation.id ?? escalation.complaint_id ?? idx;

                  const complaintCategory = escalation?.complaint?.category ?? escalation.category ?? '—';
                  const priority = escalation?.complaint?.priority ?? escalation.priority ?? 'unknown';
                  const status = escalation?.complaint?.status ?? escalation.status ?? 'Unknown';
                  const description = escalation?.complaint?.description ?? escalation.description ?? '';
                  const createdAt = escalation?.created_at ?? escalation?.escalated_at ?? null;
                  const escalatedAt = escalation?.escalated_at ?? escalation?.created_at ?? null;
                  const escalationReason = escalation?.escalation_reason ?? escalation?.reason ?? null;
                  const userEmail = escalation?.user?.email ?? escalation?.email ?? null;

                  return (
                    <Card key={key} className="border-l-4 border-l-red-500">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span>Complaint #{escalation.complaint_id ?? escalation.id ?? '—'}</span>
                            <Badge className={getPriorityColor(priority)}>
                              {(priority || 'unknown').toString().toUpperCase()
                            }
                            </Badge>
                          </div>
                          {getEscalationBadge(escalation?.escalation_level ?? 1)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium">Category</p>
                            <p className="text-sm text-muted-foreground">{complaintCategory}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Status</p>
                            <Badge variant="outline">{status}</Badge>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Description</p>
                          <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium">Submitted</p>
                            <p className="text-sm text-muted-foreground">
                              {createdAt ? new Date(createdAt).toLocaleString() : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Escalated At</p>
                            <p className="text-sm text-muted-foreground">
                              {escalatedAt ? new Date(escalatedAt).toLocaleString() : 'N/A'}
                            </p>
                          </div>
                        </div>
                        {escalationReason && (
                          <div>
                            <p className="text-sm font-medium">Escalation Reason</p>
                            <p className="text-sm text-red-600">{escalationReason}</p>
                          </div>
                        )}
                        {userEmail && (
                          <div>
                            <p className="text-sm font-medium">User Email</p>
                            <p className="text-sm text-muted-foreground">{userEmail}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EscalationHistory;
