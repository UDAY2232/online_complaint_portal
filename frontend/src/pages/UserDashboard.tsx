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
import { useNavigate } from "react-router-dom";
import { 
  Plus, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  ArrowRight,
  RefreshCw
} from "lucide-react";

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

interface DashboardStats {
  total: number;
  pending: number;
  underReview: number;
  resolved: number;
}

const UserDashboard = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    pending: 0,
    underReview: 0,
    resolved: 0,
  });
  const [recentComplaints, setRecentComplaints] = useState<Complaint[]>([]);
  const [latestComplaint, setLatestComplaint] = useState<Complaint | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const userEmail = localStorage.getItem("userEmail") || "User";

  const fetchComplaints = async () => {
    setIsLoading(true);
    try {
      const res = await api.getComplaints();
      const data = res.data.map((c: any) => ({
        ...c,
        date: c.date || c.created_at,
        resolution_message: c.resolution_message ?? null,
        resolved_image_url: c.resolved_image_url ?? null,
        problem_image_url: c.problem_image_url ?? null,
      }));
      // Show only complaints raised by this user
      const filtered = data.filter((c: any) => c.email === userEmail);
      setComplaints(filtered);

      // Calculate stats
      const newStats: DashboardStats = {
        total: filtered.length,
        pending: filtered.filter((c: Complaint) => c.status === "new").length,
        underReview: filtered.filter((c: Complaint) => c.status === "under-review").length,
        resolved: filtered.filter((c: Complaint) => c.status === "resolved").length,
      };
      setStats(newStats);

      // Get recent 5 complaints (sorted by date desc)
      const sorted = [...filtered].sort((a: Complaint, b: Complaint) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setRecentComplaints(sorted.slice(0, 5));
      setLatestComplaint(sorted[0] || null);
    } catch (error) {
      console.error('Failed to load complaints', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <Sidebar role="user" />
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Welcome Card */}
            <Card className="border-primary/20 shadow-lg">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl">Welcome back, {userEmail}</CardTitle>
                    <CardDescription className="mt-2">Here's an overview of your complaints</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={fetchComplaints}
                      disabled={isLoading}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
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
              </CardHeader>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Complaints</p>
                      <p className="text-3xl font-bold">{stats.total}</p>
                    </div>
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Pending</p>
                      <p className="text-3xl font-bold text-primary">{stats.pending}</p>
                    </div>
                    <AlertCircle className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Under Review</p>
                      <p className="text-3xl font-bold text-yellow-600">{stats.underReview}</p>
                    </div>
                    <Clock className="h-8 w-8 text-yellow-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Resolved</p>
                      <p className="text-3xl font-bold text-green-600">{stats.resolved}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Latest Complaint Status */}
            {latestComplaint && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Latest Complaint Status</CardTitle>
                  <CardDescription>Your most recent complaint update</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">#{latestComplaint.id}</span>
                        <span className="font-medium capitalize">{latestComplaint.category}</span>
                        <Badge variant="outline" className={getPriorityColor(latestComplaint.priority)}>
                          {latestComplaint.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {latestComplaint.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Submitted: {new Date(latestComplaint.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={getStatusColor(latestComplaint.status)}>
                        {latestComplaint.status === "new" && "New"}
                        {latestComplaint.status === "under-review" && "Under Review"}
                        {latestComplaint.status === "resolved" && "Resolved"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Complaints */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Complaints</CardTitle>
                  <CardDescription>Your latest submitted complaints</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/user/complaints')}
                >
                  View All
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="py-8 text-center text-muted-foreground">
                    Loading...
                  </div>
                ) : recentComplaints.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <p>No complaints yet.</p>
                    <p className="text-sm mt-2">Click "New Complaint" to submit your first complaint.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentComplaints.map((complaint) => (
                      <div
                        key={complaint.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigate('/user/complaints')}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-foreground">#{complaint.id}</span>
                            <span className="font-medium capitalize">{complaint.category}</span>
                            <Badge variant="outline" className={getPriorityColor(complaint.priority)}>
                              {complaint.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {complaint.description}
                          </p>
                        </div>
                        <Badge className={getStatusColor(complaint.status)}>
                          {complaint.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow" 
                onClick={() => navigate('/user/complaints')}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <FileText className="h-10 w-10 text-primary" />
                  <div>
                    <h3 className="font-semibold">My Complaints</h3>
                    <p className="text-sm text-muted-foreground">View all your complaints</p>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow" 
                onClick={() => navigate('/user/status')}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <Clock className="h-10 w-10 text-yellow-600" />
                  <div>
                    <h3 className="font-semibold">Track Status</h3>
                    <p className="text-sm text-muted-foreground">Track complaint by ID</p>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow" 
                onClick={() => navigate('/user/settings')}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                  <div>
                    <h3 className="font-semibold">Settings</h3>
                    <p className="text-sm text-muted-foreground">Manage your profile</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default UserDashboard;
