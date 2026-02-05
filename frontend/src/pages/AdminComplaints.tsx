import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { AlertCircle, Upload, Image, CheckCircle, Loader2, Search, Filter } from "lucide-react";

interface Complaint {
  id: number;
  category: string;
  description: string;
  priority: string;
  status: string;
  date: string;
  email?: string;
  name?: string;
  anonymous?: boolean;
  escalation_status?: string;
  escalation_level?: number;
  escalated_at?: string;
  problem_image_url?: string | null;
  resolved_image_url?: string | null;
  admin_message?: string | null;
  resolution_message?: string | null;
}

const AdminComplaints = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filteredComplaints, setFilteredComplaints] = useState<Complaint[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");
  const [resolvedImage, setResolvedImage] = useState<File | null>(null);
  const [resolvedImagePreview, setResolvedImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const fetchComplaints = async () => {
    try {
      const response = await api.getComplaints();
      const normalized = response.data.map((c: any) => ({ ...c, date: c.date || c.created_at }));
      setComplaints(normalized);
      setFilteredComplaints(normalized);
    } catch (error) {
      console.error('Error fetching complaints:', error);
      toast({
        title: "Error",
        description: "Failed to fetch complaints.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...complaints];

    // Search filter (email, category, description)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.email?.toLowerCase().includes(term) ||
        c.category?.toLowerCase().includes(term) ||
        c.description?.toLowerCase().includes(term) ||
        c.name?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== "all") {
      filtered = filtered.filter(c => c.priority === priorityFilter);
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(c => c.category === categoryFilter);
    }

    setFilteredComplaints(filtered);
  }, [complaints, searchTerm, statusFilter, priorityFilter, categoryFilter]);

  // Get unique categories for filter dropdown
  const categories = [...new Set(complaints.map(c => c.category))];

  const updateStatus = async (id: number, newStatus: string) => {
    try {
      const adminEmail = localStorage.getItem('userEmail') || 'admin';
      await api.updateComplaintStatus(id, newStatus, adminEmail);
      
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
        description: "Failed to update complaint status.",
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
      formData.append("resolution_message", adminMessage);
      
      if (resolvedImage) {
        formData.append("image", resolvedImage);
      }

      const response = await api.resolveComplaint(selectedComplaint.id, formData);
      
      // Update the complaints list with the resolved data
      if (response.data && response.data.complaint) {
        const resolvedComplaint = response.data.complaint;
        
        // Update local complaints array
        setComplaints(prevComplaints => 
          prevComplaints.map(c => 
            c.id === selectedComplaint.id 
              ? { 
                  ...c, 
                  status: 'resolved',
                  resolution_message: resolvedComplaint.resolution_message,
                  resolved_image_url: resolvedComplaint.resolved_image_url,
                  problem_image_url: resolvedComplaint.problem_image_url || c.problem_image_url,
                }
              : c
          )
        );
        
        console.log('📸 Resolved complaint data:', {
          id: resolvedComplaint.id,
          problem_image_url: resolvedComplaint.problem_image_url,
          resolved_image_url: resolvedComplaint.resolved_image_url,
          resolution_message: resolvedComplaint.resolution_message,
        });
      }
      
      toast({
        title: "Complaint Resolved",
        description: response.data?.emailSent 
          ? "Complaint resolved and notification email sent to user."
          : "Complaint resolved successfully.",
      });
      
      handleCloseDialog();
    } catch (error: any) {
      console.error("Error resolving complaint:", error);
      toast({
        title: "Error",
        description: error.response?.data?.details || "Failed to resolve complaint.",
        variant: "destructive",
      });
    } finally {
      setIsResolving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-primary text-primary-foreground";
      case "under-review": return "bg-warning text-warning-foreground";
      case "resolved": return "bg-success text-success-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "text-destructive";
      case "medium": return "text-warning";
      case "low": return "text-muted-foreground";
      default: return "text-foreground";
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setCategoryFilter("all");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <Sidebar role="admin" />
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold">All Complaints</h1>
              <p className="text-muted-foreground mt-2">
                View and manage all complaints ({filteredComplaints.length} of {complaints.length})
              </p>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  {/* Search */}
                  <div className="flex-1">
                    <Label className="text-sm mb-1 block">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by email, category, name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Status Filter */}
                  <div className="w-full md:w-40">
                    <Label className="text-sm mb-1 block">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="under-review">Under Review</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Priority Filter */}
                  <div className="w-full md:w-40">
                    <Label className="text-sm mb-1 block">Priority</Label>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priority</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category Filter */}
                  <div className="w-full md:w-40">
                    <Label className="text-sm mb-1 block">Category</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Clear Filters */}
                  <Button variant="outline" onClick={clearFilters}>
                    <Filter className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Complaints List */}
            <div className="grid gap-4">
              {filteredComplaints.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No complaints match your filters.</p>
                  </CardContent>
                </Card>
              ) : (
                filteredComplaints.map((complaint) => (
                  <Card key={complaint.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start gap-3">
                              {(complaint.escalation_level && complaint.escalation_level > 0) && (
                                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                              )}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-muted-foreground">#{complaint.id}</span>
                                  <h3 className="font-semibold capitalize">{complaint.category}</h3>
                                  <Badge variant="outline" className={getPriorityColor(complaint.priority)}>
                                    {complaint.priority} priority
                                  </Badge>
                                  {(complaint.escalation_level && complaint.escalation_level > 0) && (
                                    <Badge variant="destructive">Escalated L{complaint.escalation_level}</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {complaint.email || complaint.name || "Anonymous"} • {" "}
                                  {new Date(complaint.date).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <p className="text-sm line-clamp-2">{complaint.description}</p>
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

      {/* Complaint Detail Dialog */}
      <Dialog open={!!selectedComplaint} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">{selectedComplaint?.category}</DialogTitle>
            <DialogDescription>
              Complaint ID: #{selectedComplaint?.id}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Submitted By</p>
                <p className="text-sm text-muted-foreground">
                  {selectedComplaint?.email || selectedComplaint?.name || "Anonymous"}
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
              <p className="text-sm text-muted-foreground">{selectedComplaint?.description}</p>
            </div>

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

            {selectedComplaint?.status !== "resolved" && (
              <div className="border-t pt-4 space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Resolve Complaint
                </h4>

                <div className="space-y-2">
                  <Label htmlFor="admin_message">Resolution Message</Label>
                  <Textarea
                    id="admin_message"
                    placeholder="Enter resolution details..."
                    value={adminMessage}
                    onChange={(e) => setAdminMessage(e.target.value)}
                    rows={3}
                  />
                </div>

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
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {resolvedImage ? "Change Image" : "Upload Image"}
                    </Button>
                    {resolvedImage && (
                      <span className="text-sm text-muted-foreground">{resolvedImage.name}</span>
                    )}
                  </div>
                  
                  {resolvedImagePreview && (
                    <img
                      src={resolvedImagePreview}
                      alt="Resolution Preview"
                      className="w-full max-h-32 object-contain rounded-lg border mt-2"
                    />
                  )}
                </div>
              </div>
            )}

            {selectedComplaint?.status === "resolved" && (
              <div className="border-t pt-4 space-y-4">
                <h4 className="font-semibold flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Resolution Details
                </h4>
                {selectedComplaint?.resolution_message && (
                  <div>
                    <p className="text-sm font-medium">Resolution Message</p>
                    <p className="text-sm text-muted-foreground">{selectedComplaint.resolution_message}</p>
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

          {selectedComplaint?.status !== "resolved" && (
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
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

export default AdminComplaints;
