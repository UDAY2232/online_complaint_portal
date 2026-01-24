import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ComplaintForm from "@/components/ComplaintForm";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { Plus, Search, RefreshCw, Eye, Image, CheckCircle } from "lucide-react";

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

const UserComplaints = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filteredComplaints, setFilteredComplaints] = useState<Complaint[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const { toast } = useToast();
  const userEmail = localStorage.getItem("userEmail") || "User";

  const fetchComplaints = async () => {
    setIsLoading(true);
    try {
      // ✅ Use protected endpoint - returns ONLY this user's complaints
      const res = await api.getUserComplaints();
      const data = res.data.map((c: any) => ({
        ...c,
        date: c.date || c.created_at,
        resolution_message: c.resolution_message ?? null,
        resolved_image_url: c.resolved_image_url ?? null,
        problem_image_url: c.problem_image_url ?? null,
      }));
      
      // No need to filter - backend already returns only user's complaints
      setComplaints(data.reverse());
      setFilteredComplaints(data);
    } catch (error) {
      console.error('Failed to load complaints', error);
      toast({
        title: 'Error',
        description: 'Failed to load complaints from server',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  // Apply filters
  useEffect(() => {
    let result = [...complaints];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.category.toLowerCase().includes(term) ||
        c.description.toLowerCase().includes(term)
      );
    }
    
    if (statusFilter !== "all") {
      result = result.filter(c => c.status === statusFilter);
    }
    
    if (priorityFilter !== "all") {
      result = result.filter(c => c.priority === priorityFilter);
    }
    
    setFilteredComplaints(result);
  }, [searchTerm, statusFilter, priorityFilter, complaints]);

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
      case "medium": return "text-yellow-600";
      default: return "text-muted-foreground";
    }
  };

  const handleComplaintSubmitted = () => {
    fetchComplaints();
    setIsDialogOpen(false);
    toast({
      title: "Complaint Submitted",
      description: "Your complaint has been submitted successfully.",
    });
  };

  const openDetails = async (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    try {
      const res = await api.getComplaintHistory(complaint.id);
      setHistoryData(res.data || []);
    } catch (err) {
      console.error('Failed to load history', err);
      setHistoryData([]);
    }
    setIsDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setSelectedComplaint(null);
    setHistoryData([]);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setPriorityFilter("all");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <Sidebar role="user" />
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold">My Complaints</h1>
                <p className="text-muted-foreground mt-1">
                  View and manage all your submitted complaints
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={fetchComplaints}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
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
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by category or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="under-review">Under Review</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  {(searchTerm || statusFilter !== "all" || priorityFilter !== "all") && (
                    <Button variant="ghost" onClick={clearFilters}>
                      Clear
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Results Count */}
            <div className="text-sm text-muted-foreground">
              Showing {filteredComplaints.length} of {complaints.length} complaints
            </div>

            {/* Complaints List */}
            <div className="grid gap-4">
              {isLoading ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Loading your complaints...</p>
                  </CardContent>
                </Card>
              ) : filteredComplaints.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">
                      {complaints.length === 0 
                        ? "No complaints yet. Submit your first complaint to get started."
                        : "No complaints match your filters."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredComplaints.map((complaint) => (
                  <Card key={complaint.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">#{complaint.id}</span>
                            <h3 className="font-semibold capitalize">{complaint.category}</h3>
                            <Badge variant="outline" className={getPriorityColor(complaint.priority)}>
                              {complaint.priority} priority
                            </Badge>
                            {complaint.status === "resolved" && (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Resolved
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {complaint.description}
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>Submitted: {new Date(complaint.date).toLocaleDateString()}</span>
                            {complaint.problem_image_url && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Image className="h-3 w-3" />
                                  Has attachment
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={getStatusColor(complaint.status)}>
                            {complaint.status === "new" && "New"}
                            {complaint.status === "under-review" && "Under Review"}
                            {complaint.status === "resolved" && "Resolved"}
                          </Badge>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => openDetails(complaint)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
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

      {/* Complaint Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={handleCloseDetails}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">{selectedComplaint?.category}</DialogTitle>
            <DialogDescription>
              Complaint ID: #{selectedComplaint?.id}
            </DialogDescription>
          </DialogHeader>
          
          {selectedComplaint && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <Badge className={getStatusColor(selectedComplaint.status)}>
                    {selectedComplaint.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium">Priority</p>
                  <Badge variant="outline" className={getPriorityColor(selectedComplaint.priority)}>
                    {selectedComplaint.priority}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium">Submitted On</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedComplaint.date).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Category</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {selectedComplaint.category}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-sm font-medium">Description</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedComplaint.description}
                </p>
              </div>

              {/* Problem Image */}
              {selectedComplaint.problem_image_url && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Attached Image
                  </p>
                  <img
                    src={selectedComplaint.problem_image_url}
                    alt="Problem"
                    className="w-full max-h-48 object-contain rounded-lg border"
                  />
                </div>
              )}

              {/* Resolution Details - Only show if resolved */}
              {selectedComplaint.status === "resolved" && (
                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-semibold flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Resolution Details
                  </h4>
                  
                  {selectedComplaint.resolution_message && (
                    <div>
                      <p className="text-sm font-medium">Resolution Message</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedComplaint.resolution_message}
                      </p>
                    </div>
                  )}
                  
                  {selectedComplaint.resolved_image_url && (
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
                          <div className="font-medium text-sm">
                            {h.old_status ?? 'Created'} → {h.new_status}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(h.changed_at).toLocaleString()}
                          </div>
                        </div>
                        {h.changed_by && (
                          <div className="text-xs text-muted-foreground mt-1">
                            By: {h.changed_by}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserComplaints;
