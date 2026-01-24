import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  FileText, 
  TrendingUp, 
  AlertTriangle,
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
  email?: string;
  escalation_level?: number;
}

interface DashboardStats {
  total: number;
  pending: number;
  underReview: number;
  resolved: number;
  highPriority: number;
  escalated: number;
}

const AdminDashboard = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    pending: 0,
    underReview: 0,
    resolved: 0,
    highPriority: 0,
    escalated: 0,
  });
  const [recentComplaints, setRecentComplaints] = useState<Complaint[]>([]);
  const [isCheckingEscalations, setIsCheckingEscalations] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchComplaints = async () => {
    setIsLoading(true);
    try {
      const response = await api.getComplaints();
      const normalized = response.data.map((c: any) => ({ 
        ...c, 
        date: c.date || c.created_at 
      }));
      
      setComplaints(normalized);
      
      // Calculate stats
      const newStats: DashboardStats = {
        total: normalized.length,
        pending: normalized.filter((c: Complaint) => c.status === "new").length,
        underReview: normalized.filter((c: Complaint) => c.status === "under-review").length,
        resolved: normalized.filter((c: Complaint) => c.status === "resolved").length,
        highPriority: normalized.filter((c: Complaint) => c.priority === "high").length,
        escalated: normalized.filter((c: Complaint) => c.escalation_level && c.escalation_level > 0).length,
      };
      setStats(newStats);

      // Get recent 5 complaints (sorted by date desc)
      const sorted = [...normalized].sort((a: Complaint, b: Complaint) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setRecentComplaints(sorted.slice(0, 5));
    } catch (error) {
      console.error('Error fetching complaints:', error);
      toast({
        title: "Error",
        description: "Failed to fetch dashboard data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <Sidebar role="admin" />
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                <p className="text-muted-foreground mt-2">
                  Overview of complaint management system
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={fetchComplaints}
                  variant="outline"
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button 
                  onClick={checkEscalations}
                  disabled={isCheckingEscalations}
                  variant="outline"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {isCheckingEscalations ? "Checking..." : "Check Escalations"}
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total</p>
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
                      <p className="text-sm font-medium text-muted-foreground">New</p>
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

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">High Priority</p>
                      <p className="text-3xl font-bold text-destructive">{stats.highPriority}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-destructive" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Escalated</p>
                      <p className="text-3xl font-bold text-orange-600">{stats.escalated}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Complaints */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Complaints</CardTitle>
                  <CardDescription>Latest 5 complaints submitted</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/admin/complaints')}
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
                    No complaints yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentComplaints.map((complaint) => (
                      <div
                        key={complaint.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-foreground">#{complaint.id}</span>
                            <span className="font-medium capitalize">{complaint.category}</span>
                            <Badge variant="outline" className={getPriorityColor(complaint.priority)}>
                              {complaint.priority}
                            </Badge>
                            {complaint.escalation_level && complaint.escalation_level > 0 && (
                              <Badge variant="destructive" className="text-xs">Escalated</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {complaint.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {complaint.email || complaint.name || "Anonymous"} • {new Date(complaint.date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={getStatusColor(complaint.status)}>
                            {complaint.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/complaints')}>
                <CardContent className="p-6 flex items-center gap-4">
                  <FileText className="h-10 w-10 text-primary" />
                  <div>
                    <h3 className="font-semibold">Manage Complaints</h3>
                    <p className="text-sm text-muted-foreground">View and resolve all complaints</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/escalations')}>
                <CardContent className="p-6 flex items-center gap-4">
                  <AlertTriangle className="h-10 w-10 text-orange-600" />
                  <div>
                    <h3 className="font-semibold">Escalations</h3>
                    <p className="text-sm text-muted-foreground">View escalation history</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/users')}>
                <CardContent className="p-6 flex items-center gap-4">
                  <TrendingUp className="h-10 w-10 text-green-600" />
                  <div>
                    <h3 className="font-semibold">User Management</h3>
                    <p className="text-sm text-muted-foreground">Manage registered users</p>
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

export default AdminDashboard;
