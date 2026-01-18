import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Complaint {
  id: number;
  category: string;
  description: string;
  priority: string;
  status: string;
  date: string;
  name?: string;
  resolution_message?: string | null;
  resolved_image_url?: string | null;
  problem_image_url?: string | null;
}

const StatusTracker = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const { toast } = useToast();
  const userEmail = localStorage.getItem("userEmail") || "User";

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const res = await api.getComplaints();
        const data = res.data.map((c: any) => ({
          ...c,
          date: c.date || c.created_at,
          // Ensure nullable fields are handled
          resolution_message: c.resolution_message ?? null,
          resolved_image_url: c.resolved_image_url ?? null,
          problem_image_url: c.problem_image_url ?? null,
        }));
        const filtered = data.filter((c: any) => c.email === userEmail);
        setComplaints(filtered.reverse());
      } catch (err) {
        console.error("Failed to load complaints from API, falling back to localStorage", err);
        const stored = JSON.parse(localStorage.getItem("complaints") || "[]");
        setComplaints(stored.filter((c: any) => c.name === (userEmail || "User")).reverse());
        toast({ title: 'Error', description: 'Failed to load complaints from server', variant: 'destructive' });
      }
    };

    fetchComplaints();
  }, []);

  const openHistory = async (complaintId: number) => {
    try {
      // Find the complaint from the list to show its details
      const complaint = complaints.find(c => c.id === complaintId) || null;
      setSelectedComplaint(complaint);
      
      const res = await api.getComplaintHistory(complaintId);
      setHistoryData(res.data || []);
      setIsHistoryOpen(true);
    } catch (err) {
      console.error('Failed to load history', err);
      toast({ title: 'Error', description: 'Failed to load complaint history', variant: 'destructive' });
    }
  };

  const handleCloseHistory = () => {
    setIsHistoryOpen(false);
    setSelectedComplaint(null);
    setHistoryData([]);
  };

  const getStatusSteps = (currentStatus: string) => {
    const steps = [
      { label: "New", value: "new", icon: Circle },
      { label: "Under Review", value: "under-review", icon: Clock },
      { label: "Resolved", value: "resolved", icon: CheckCircle2 },
    ];

    const currentIndex = steps.findIndex((s) => s.value === currentStatus);

    return steps.map((step, index) => ({
      ...step,
      completed: index <= currentIndex,
      active: index === currentIndex,
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-primary text-primary-foreground";
      case "under-review":
        return "bg-warning text-warning-foreground";
      case "resolved":
        return "bg-success text-success-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <Sidebar role="user" />
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Track Complaint Status</h1>
              <p className="text-muted-foreground mt-2">
                Monitor the progress of your submitted complaints
              </p>
            </div>

            <div className="space-y-6">
              {complaints.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">
                      No complaints to track. Submit a complaint to see its status here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                complaints.map((complaint) => (
                  <Card key={complaint.id} className="overflow-hidden">
                    <CardHeader className="bg-muted/30">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <CardTitle className="capitalize">{complaint.category}</CardTitle>
                          <CardDescription>
                            Submitted on {new Date(complaint.date).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <Badge className={getStatusColor(complaint.status)}>
                          {complaint.status === "new" && "New"}
                          {complaint.status === "under-review" && "Under Review"}
                          {complaint.status === "resolved" && "Resolved"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="space-y-6">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Description</p>
                          <p className="text-sm">{complaint.description}</p>
                        </div>

                        <div>
                          <p className="text-sm font-medium mb-4">Status Timeline</p>
                          <div className="relative">
                            <div className="flex items-center justify-between">
                              {getStatusSteps(complaint.status).map((step, index) => (
                                <div key={step.value} className="flex flex-col items-center flex-1">
                                  <div className="relative flex items-center justify-center w-full">
                                    {index > 0 && (
                                      <div
                                        className={`absolute right-1/2 h-0.5 w-full ${
                                          step.completed
                                            ? "bg-primary"
                                            : "bg-muted"
                                        }`}
                                      />
                                    )}
                                    <div
                                      className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                                        step.completed
                                          ? "border-primary bg-primary text-primary-foreground"
                                          : "border-muted bg-background text-muted-foreground"
                                      }`}
                                    >
                                      <step.icon className="h-5 w-5" />
                                    </div>
                                    {index < 2 && (
                                      <div
                                        className={`absolute left-1/2 h-0.5 w-full ${
                                          getStatusSteps(complaint.status)[index + 1].completed
                                            ? "bg-primary"
                                            : "bg-muted"
                                        }`}
                                      />
                                    )}
                                  </div>
                                  <p
                                    className={`mt-2 text-xs font-medium ${
                                      step.completed
                                        ? "text-foreground"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {step.label}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Priority: <span className="capitalize font-medium">{complaint.priority}</span></span>
                          <span>•</span>
                          <span>ID: #{complaint.id}</span>
                        </div>
                        <div className="flex items-center justify-end mt-4">
                          <Button variant="outline" size="sm" onClick={() => openHistory(complaint.id)}>View Progress</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
      {/* History dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={handleCloseHistory}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complaint Progress</DialogTitle>
            <DialogDescription>Timeline of status changes</DialogDescription>
          </DialogHeader>
          
          {/* Before Image - User uploaded problem image */}
          {selectedComplaint?.problem_image_url ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Before (User Uploaded Image)</p>
              <img
                src={selectedComplaint.problem_image_url}
                alt="Problem"
                className="w-full max-h-48 object-contain rounded-lg border"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">Before (User Uploaded Image)</p>
              <p className="text-sm text-muted-foreground">No image provided</p>
            </div>
          )}

          {/* After Image & Resolution - Only show if resolved */}
          {selectedComplaint?.status === "resolved" && (
            <div className="space-y-4 border-t pt-4">
              {selectedComplaint?.resolution_message ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Resolution Message</p>
                  <p className="text-sm text-muted-foreground">{selectedComplaint.resolution_message}</p>
                </div>
              ) : null}
              
              {selectedComplaint?.resolved_image_url ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">After (Resolved Image)</p>
                  <img
                    src={selectedComplaint.resolved_image_url}
                    alt="Resolution"
                    className="w-full max-h-48 object-contain rounded-lg border"
                  />
                </div>
              ) : null}
            </div>
          )}

          {/* Status Timeline */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Status Timeline</p>
            {historyData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No history available.</p>
            ) : (
              <div className="space-y-3">
                {historyData.map((h) => (
                  <div key={h.id} className="p-3 border rounded">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{h.old_status ?? 'Created'} → {h.new_status}</div>
                      <div className="text-xs text-muted-foreground">{new Date(h.changed_at).toLocaleString()}</div>
                    </div>
                    {h.changed_by && <div className="text-sm text-muted-foreground">By: {h.changed_by}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StatusTracker;
