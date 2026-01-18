import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ComplaintForm from "@/components/ComplaintForm";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { Plus } from "lucide-react";

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

const UserDashboard = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [trackingIdInput, setTrackingIdInput] = useState('');
  const [trackedComplaint, setTrackedComplaint] = useState<any | null>(null);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const { toast } = useToast();
  const userEmail = localStorage.getItem("userEmail") || "User";

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
      // show only complaints raised by this user
      const filtered = data.filter((c: any) => c.email === userEmail);
      setComplaints(filtered.reverse());
    } catch (error) {
      console.error('Failed to load complaints from API, falling back to localStorage', error);
      const stored = JSON.parse(localStorage.getItem("complaints") || "[]");
      // filter by user as before
      setComplaints(stored.filter((c: any) => c.name === (userEmail || 'User')).reverse());
      toast({
        title: 'Error',
        description: 'Failed to load complaints from server',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

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

  const handleComplaintSubmitted = (created?: any) => {
    // Refresh the list from API to get full complaint data (id, timestamps, etc.)
    fetchComplaints();
    setIsDialogOpen(false);
    if (created && created.trackingId) {
      toast({ title: 'Anonymous complaint submitted', description: `Tracking ID: ${created.trackingId}` });
    }
  };

  const handleTrack = async () => {
    if (!trackingIdInput) return toast({ title: 'Enter tracking id', description: 'Please enter a tracking id to lookup', variant: 'destructive' });
    try {
      const res = await api.getTrack(trackingIdInput.trim());
      setTrackedComplaint(res.data);
      setIsTrackingOpen(true);
    } catch (err: any) {
      console.error('Tracking lookup failed', err);
      toast({ title: 'Not found', description: err.response?.data?.error || 'Complaint not found', variant: 'destructive' });
    }
  };

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <Sidebar role="user" />
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <Card className="border-primary/20 shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl">Welcome, {userEmail}</CardTitle>
                <CardDescription>Manage and track your complaints</CardDescription>
              </CardHeader>
            </Card>

            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">My Complaints</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => fetchComplaints()}>Refresh</Button>
                <input
                  className="border rounded px-2 py-1"
                  placeholder="Tracking ID"
                  value={trackingIdInput}
                  onChange={(e) => setTrackingIdInput(e.target.value)}
                />
                <Button variant="ghost" onClick={handleTrack}>Track</Button>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Complaint
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Submit New Complaint</DialogTitle>
                    <DialogDescription>
                      Fill out the form below to submit your complaint
                    </DialogDescription>
                  </DialogHeader>
                  <ComplaintForm onSubmit={handleComplaintSubmitted} />
                </DialogContent>
                </Dialog>
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

            {/* Tracking result dialog */}
            <Dialog open={isTrackingOpen} onOpenChange={setIsTrackingOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tracking Result</DialogTitle>
                  <DialogDescription>Details for tracking id</DialogDescription>
                </DialogHeader>
                {trackedComplaint ? (
                  <div className="space-y-4">
                    <p className="font-semibold">Category: {trackedComplaint.category}</p>
                    <p>Status: {trackedComplaint.status}</p>
                    <p>Priority: {trackedComplaint.priority}</p>
                    <p>Submitted: {new Date(trackedComplaint.created_at || trackedComplaint.date).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">{trackedComplaint.description}</p>
                  </div>
                ) : (
                  <p>No result</p>
                )}
              </DialogContent>
            </Dialog>

            <div className="grid gap-4">
              {complaints.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No complaints yet. Submit your first complaint to get started.</p>
                  </CardContent>
                </Card>
              ) : (
                complaints.map((complaint) => (
                  <Card key={complaint.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <h3 className="font-semibold capitalize">{complaint.category}</h3>
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {complaint.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                            <span>
                              {new Date(complaint.date).toLocaleDateString()}
                            </span>
                            <span>•</span>
                            <span className="capitalize">Priority: {complaint.priority}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={getStatusColor(complaint.status)}>
                          {complaint.status === "new" && "New"}
                          {complaint.status === "under-review" && "Under Review"}
                          {complaint.status === "resolved" && "Resolved"}
                          </Badge>
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
    </div>
  );
};

export default UserDashboard;
