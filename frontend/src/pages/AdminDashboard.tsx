import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

import { AlertCircle, Upload, Image, CheckCircle, Loader2 } from "lucide-react";

interface Complaint {
  id: number;
  category: string;
  description: string;
  priority: string;
  status: string;
  date: string;
  name?: string;
  anonymous?: boolean;
  escalation_status?: string;
  escalated_at?: string;
  problem_image_url?: string;
  resolved_image_url?: string;
  admin_message?: string;
}

const AdminDashboard = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [isCheckingEscalations, setIsCheckingEscalations] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");
  const [resolvedImage, setResolvedImage] = useState<File | null>(null);
  const [resolvedImagePreview, setResolvedImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchComplaints = async () => {
    try {
      const response = await api.getComplaints();
      // normalize created_at -> date for compatibility and show only user-raised complaints
      const normalized = response.data.map((c: any) => ({ ...c, date: c.date || c.created_at }));
      setComplaints(normalized.filter((c: any) => !c.is_anonymous));
    } catch (error) {
      console.error('Error fetching complaints:', error);
      toast({
        title: "Error",
        description: "Failed to fetch complaints. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const checkEscalations = async () => {
    setIsCheckingEscalations(true);
    try {
      const response = await api.checkEscalations();
      const escalatedCount = response.data.escalated?.length || 0;
      
      toast({
        title: "Escalation check complete",
        description: `${escalatedCount} complaints escalated`
      });
      
      // Reload complaints
      fetchComplaints();
    } catch (error: any) {
      console.error("Escalation check failed:", error);
      toast({
        title: "Escalation check failed",
        description: error.message || "Failed to check escalations",
        variant: "destructive",
      });
    } finally {
      setIsCheckingEscalations(false);
    }
  };

  const updateStatus = async (id: number, newStatus: string) => {
    try {
      const adminEmail = localStorage.getItem('userEmail') || 'admin';
      await api.updateComplaintStatus(id, newStatus, adminEmail);
      
      // Update local state
      setComplaints(complaints.map(c =>
        c.id === id ? { ...c, status: newStatus } : c
      ));
      
      toast({
        title: "Status updated",
        description: "Complaint status has been updated successfully.",
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update complaint status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResolvedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setResolvedImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetResolveForm = () => {
    setAdminMessage("");
    setResolvedImage(null);
    setResolvedImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCloseDialog = () => {
    setSelectedComplaint(null);
    resetResolveForm();
  };

  const handleResolveComplaint = async () => {
    if (!selectedComplaint) return;

    setIsResolving(true);
    try {
      const formData = new FormData();
      
      // Field name must match backend: resolution_message
      formData.append("resolution_message", adminMessage);
      
      // Field name must match backend: image
      if (resolvedImage) {
        formData.append("image", resolvedImage);
      }

      console.log("Sending resolve request for complaint:", selectedComplaint.id);
      
      const response = await api.resolveComplaint(selectedComplaint.id, formData);
      console.log("Response:", response.data);

      toast({
        title: "Complaint Resolved",
        description: "The complaint has been marked as resolved successfully.",
      });

      // Refresh complaints list
      await fetchComplaints();
      
      // Close dialog and reset form
      handleCloseDialog();
    } catch (error: any) {
      console.error("Error resolving complaint:", error);
      console.error("Response:", error.response?.data);
      toast({
        title: "Error",
        description: error.response?.data?.details || "Failed to resolve complaint. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResolving(false);
    }
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-destructive";
      case "medium":
        return "text-warning";
      case "low":
        return "text-muted-foreground";
      default:
        return "text-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <Sidebar role="admin" />
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                <p className="text-muted-foreground mt-2">
                  Manage and resolve all complaints
                </p>
              </div>
              <Button 
                onClick={checkEscalations}
                disabled={isCheckingEscalations}
                variant="outline"
              >
                {isCheckingEscalations ? "Checking..." : "Check Escalations"}
              </Button>
            </div>

            <div className="grid gap-4">
              {complaints.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No complaints to display.</p>
                  </CardContent>
                </Card>
              ) : (
                complaints.map((complaint) => (
                  <Card key={complaint.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start gap-3">
                              {complaint.escalation_status === "escalated" && (
                                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                              )}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold capitalize">{complaint.category}</h3>
                                  <Badge variant="outline" className={getPriorityColor(complaint.priority)}>
                                    {complaint.priority} priority
                                  </Badge>
                                  {complaint.escalation_status === "escalated" && (
                                    <Badge variant="destructive">Escalated</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Submitted by: {complaint.name || "Anonymous"} • {" "}
                                  {new Date(complaint.date).toLocaleDateString()}
                                  {complaint.escalated_at && (
                                    <> • Escalated: {new Date(complaint.escalated_at).toLocaleDateString()}</>
                                  )}
                                </p>
                              </div>
                            </div>
                            <p className="text-sm">{complaint.description}</p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Status:</span>
                            <Select
                              value={complaint.status}
                              onValueChange={(value) => updateStatus(complaint.id, value)}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="under-review">Under Review</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Badge className={getStatusColor(complaint.status)}>
                            {complaint.status === "new" && "New"}
                            {complaint.status === "under-review" && "Under Review"}
                            {complaint.status === "resolved" && "Resolved"}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedComplaint(complaint)}
                          >
                            View Details
                          </Button>
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

      <Dialog open={!!selectedComplaint} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">{selectedComplaint?.category}</DialogTitle>
            <DialogDescription>
              Complaint ID: {selectedComplaint?.id}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Submitted By</p>
                <p className="text-sm text-muted-foreground">
                  {selectedComplaint?.name || "Anonymous"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Date</p>
                <p className="text-sm text-muted-foreground">
                  {selectedComplaint && new Date(selectedComplaint.date).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Priority</p>
                <Badge variant="outline" className={selectedComplaint && getPriorityColor(selectedComplaint.priority)}>
                  {selectedComplaint?.priority}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium">Status</p>
                <Badge className={selectedComplaint && getStatusColor(selectedComplaint.status)}>
                  {selectedComplaint?.status}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Description</p>
              <p className="text-sm text-muted-foreground">
                {selectedComplaint?.description}
              </p>
            </div>

            {/* Problem Image Section */}
            {selectedComplaint?.problem_image_url && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Problem Image
                </p>
                <img
                  src={selectedComplaint.problem_image_url}
                  alt="Problem"
                  className="w-full max-h-48 object-contain rounded-lg border"
                />
              </div>
            )}

            {/* Resolve Section - Only show if not already resolved */}
            {selectedComplaint?.status !== "resolved" && (
              <div className="border-t pt-4 space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Resolve Complaint
                </h4>

                {/* Admin Message */}
                <div className="space-y-2">
                  <Label htmlFor="admin_message">Resolution Message</Label>
                  <Textarea
                    id="admin_message"
                    placeholder="Enter resolution details or message for the user..."
                    value={adminMessage}
                    onChange={(e) => setAdminMessage(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Resolved Image Upload */}
                <div className="space-y-2">
                  <Label htmlFor="resolved_image">Resolution Image (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      ref={fileInputRef}
                      id="resolved_image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {resolvedImage ? "Change Image" : "Upload Image"}
                    </Button>
                    {resolvedImage && (
                      <span className="text-sm text-muted-foreground">
                        {resolvedImage.name}
                      </span>
                    )}
                  </div>
                  
                  {/* Image Preview */}
                  {resolvedImagePreview && (
                    <div className="mt-2">
                      <img
                        src={resolvedImagePreview}
                        alt="Resolution Preview"
                        className="w-full max-h-32 object-contain rounded-lg border"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Show resolved info if already resolved */}
            {selectedComplaint?.status === "resolved" && (
              <div className="border-t pt-4 space-y-4">
                <h4 className="font-semibold flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Resolution Details
                </h4>
                {selectedComplaint?.admin_message && (
                  <div>
                    <p className="text-sm font-medium">Admin Message</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedComplaint.admin_message}
                    </p>
                  </div>
                )}
                {selectedComplaint?.resolved_image_url && (
                  <div>
                    <p className="text-sm font-medium mb-2">Resolution Image</p>
                    <img
                      src={selectedComplaint.resolved_image_url}
                      alt="Resolution"
                      className="w-full max-h-48 object-contain rounded-lg border"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer with Resolve Button */}
          {selectedComplaint?.status !== "resolved" && (
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleResolveComplaint}
                disabled={isResolving}
                className="bg-green-600 hover:bg-green-700"
              >
                {isResolving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resolving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark as Resolved
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
