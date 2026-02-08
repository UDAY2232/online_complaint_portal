import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { 
  AlertTriangle,
  RefreshCw,
  User,
  Mail,
  Calendar,
  ShieldAlert,
  ArrowUpCircle,
  TrendingUp,
  CheckCircle2,
  Clock,
  BarChart3,
  UserCog,
  Bell,
  Eye
} from "lucide-react";

interface EscalatedComplaint {
  id: number;
  category: string;
  description: string;
  priority: string;
  status: string;
  escalation_level: number;
  created_at: string;
  escalated_at?: string;
  name?: string;
  email?: string;
  problem_image_url?: string;
  assigned_to?: number;
  assigned_admin_name?: string;
}

interface Admin {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
}

interface Stats {
  overall: {
    total_complaints: number;
    new_complaints: number;
    under_review: number;
    resolved: number;
    escalated: number;
    critical_escalations: number;
    high_priority: number;
  };
  byEscalationLevel: Array<{ escalation_level: number; count: number }>;
  byPriority: Array<{ priority: string; total: number; resolved: number; escalated: number }>;
  adminPerformance: Array<{ id: number; name: string; email: string; resolved_count: number; avg_resolution_hours: number }>;
}

const SuperAdminDashboard = () => {
  const [complaints, setComplaints] = useState<EscalatedComplaint[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState<EscalatedComplaint | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<string>("");
  const { toast } = useToast();

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [complaintsRes, statsRes, adminsRes] = await Promise.all([
        api.getEscalatedComplaints(),
        api.getSuperadminStats().catch(() => ({ data: { stats: null } })),
        api.getAllAdmins().catch(() => ({ data: { admins: [] } }))
      ]);
      
      setComplaints(complaintsRes.data.complaints || []);
      setStats(statsRes.data.stats);
      setAdmins(adminsRes.data.admins || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
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
    fetchAllData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchAllData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleManualEscalate = async (complaint: EscalatedComplaint) => {
    try {
      await api.manualEscalate(complaint.id, "Manual escalation by superadmin");
      toast({
        title: "Success",
        description: `Complaint #${complaint.id} has been escalated to Level ${complaint.escalation_level + 1}.`,
      });
      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to escalate complaint.",
        variant: "destructive",
      });
    }
  };

  const handleAssignComplaint = async () => {
    if (!selectedComplaint || !selectedAdmin) return;
    
    try {
      await api.assignComplaint(selectedComplaint.id, parseInt(selectedAdmin));
      toast({
        title: "Success",
        description: `Complaint #${selectedComplaint.id} has been assigned.`,
      });
      setShowAssignDialog(false);
      setSelectedAdmin("");
      fetchAllData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to assign complaint.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-primary text-primary-foreground";
      case "under-review": return "bg-yellow-500 text-white";
      case "resolved": return "bg-green-500 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-500 text-white";
      case "medium": return "bg-yellow-500 text-white";
      default: return "bg-blue-500 text-white";
    }
  };

  const getEscalationColor = (level: number) => {
    if (level >= 3) return "bg-red-600 text-white";
    if (level === 2) return "bg-orange-500 text-white";
    return "bg-yellow-500 text-white";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate local stats
  const localStats = {
    total: complaints.length,
    level1: complaints.filter(c => c.escalation_level === 1).length,
    level2: complaints.filter(c => c.escalation_level === 2).length,
    level3Plus: complaints.filter(c => c.escalation_level >= 3).length,
    highPriority: complaints.filter(c => c.priority === "high").length,
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <Sidebar role="superadmin" />
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <ShieldAlert className="h-8 w-8 text-primary" />
                  Super Admin Dashboard
                </h1>
                <p className="text-muted-foreground mt-2">
                  Overview of all escalated complaints requiring attention
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={fetchAllData}
                  variant="outline"
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="border-l-4 border-l-orange-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Escalated</p>
                      <p className="text-3xl font-bold">{localStats.total}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-yellow-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Level 1</p>
                      <p className="text-3xl font-bold text-yellow-500">{localStats.level1}</p>
                    </div>
                    <ArrowUpCircle className="h-8 w-8 text-yellow-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Level 2</p>
                      <p className="text-3xl font-bold text-orange-500">{localStats.level2}</p>
                    </div>
                    <ArrowUpCircle className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-red-600">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Level 3+</p>
                      <p className="text-3xl font-bold text-red-600">{localStats.level3Plus}</p>
                    </div>
                    <ShieldAlert className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-destructive">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">High Priority</p>
                      <p className="text-3xl font-bold text-destructive">{localStats.highPriority}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="escalated" className="space-y-4">
              <TabsList>
                <TabsTrigger value="escalated" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Escalated Complaints
                </TabsTrigger>
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="admins" className="flex items-center gap-2">
                  <UserCog className="h-4 w-4" />
                  Admin Performance
                </TabsTrigger>
              </TabsList>

              {/* Escalated Complaints Tab */}
              <TabsContent value="escalated">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      Escalated Complaints
                    </CardTitle>
                    <CardDescription>
                      All complaints with escalation level &gt; 0, ordered by severity
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="flex justify-center py-8">
                        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : complaints.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                        <p className="text-lg font-medium">All caught up!</p>
                        <p className="text-sm">No escalated complaints at the moment</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {complaints.map((complaint) => (
                          <div
                            key={complaint.id}
                            className={`border rounded-lg p-4 transition-all hover:shadow-md ${
                              complaint.escalation_level >= 3 ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20' :
                              complaint.escalation_level === 2 ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/20' :
                              'hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <Badge className={getEscalationColor(complaint.escalation_level)}>
                                    Level {complaint.escalation_level}
                                  </Badge>
                                  <Badge className={getPriorityColor(complaint.priority)}>
                                    {complaint.priority}
                                  </Badge>
                                  <Badge className={getStatusColor(complaint.status)}>
                                    {complaint.status}
                                  </Badge>
                                  <Badge variant="outline">{complaint.category}</Badge>
                                  {complaint.assigned_admin_name && (
                                    <Badge variant="secondary">
                                      Assigned: {complaint.assigned_admin_name}
                                    </Badge>
                                  )}
                                </div>
                                
                                <p className="text-sm text-foreground line-clamp-2 mb-3">
                                  {complaint.description}
                                </p>
                                
                                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                  {complaint.name && (
                                    <span className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      {complaint.name}
                                    </span>
                                  )}
                                  {complaint.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      {complaint.email}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {formatDate(complaint.created_at)}
                                  </span>
                                  {complaint.escalated_at && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      Escalated: {formatDate(complaint.escalated_at)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex flex-col gap-2">
                                <p className="text-xs text-muted-foreground text-right">ID: #{complaint.id}</p>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedComplaint(complaint);
                                      setShowDetailsDialog(true);
                                    }}
                                    title="View Details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedComplaint(complaint);
                                      setShowAssignDialog(true);
                                    }}
                                    title="Assign to Admin"
                                  >
                                    <UserCog className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleManualEscalate(complaint)}
                                    title="Escalate Further"
                                  >
                                    <ArrowUpCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Overview Tab */}
              <TabsContent value="overview">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Overall Stats */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        System Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {stats?.overall ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-4 bg-muted rounded-lg">
                              <p className="text-3xl font-bold">{stats.overall.total_complaints}</p>
                              <p className="text-sm text-muted-foreground">Total Complaints</p>
                            </div>
                            <div className="text-center p-4 bg-green-100 dark:bg-green-950 rounded-lg">
                              <p className="text-3xl font-bold text-green-600">{stats.overall.resolved}</p>
                              <p className="text-sm text-muted-foreground">Resolved</p>
                            </div>
                            <div className="text-center p-4 bg-blue-100 dark:bg-blue-950 rounded-lg">
                              <p className="text-3xl font-bold text-blue-600">{stats.overall.new_complaints}</p>
                              <p className="text-sm text-muted-foreground">New</p>
                            </div>
                            <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-950 rounded-lg">
                              <p className="text-3xl font-bold text-yellow-600">{stats.overall.under_review}</p>
                              <p className="text-sm text-muted-foreground">Under Review</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">Loading stats...</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* By Priority */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        By Priority
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {stats?.byPriority ? (
                        <div className="space-y-3">
                          {stats.byPriority.map((item) => (
                            <div key={item.priority} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div className="flex items-center gap-2">
                                <Badge className={getPriorityColor(item.priority)}>
                                  {item.priority}
                                </Badge>
                              </div>
                              <div className="flex gap-4 text-sm">
                                <span>Total: <strong>{item.total}</strong></span>
                                <span className="text-green-600">Resolved: {item.resolved}</span>
                                <span className="text-orange-600">Escalated: {item.escalated}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">Loading...</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Notification Status */}
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-primary" />
                        Email Notification Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-green-100 dark:bg-green-950 p-4 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <p className="font-medium text-green-700 dark:text-green-400">
                            Email Notifications Active
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          You will receive email notifications when complaints are escalated to Level 2 or higher.
                          Admins are also notified for all escalations.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Admin Performance Tab */}
              <TabsContent value="admins">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserCog className="h-5 w-5 text-primary" />
                      Admin Performance
                    </CardTitle>
                    <CardDescription>
                      Overview of admin activity and resolution metrics
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {stats?.adminPerformance && stats.adminPerformance.length > 0 ? (
                      <div className="space-y-3">
                        {stats.adminPerformance.map((admin) => (
                          <div key={admin.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{admin.name || admin.email}</p>
                                <p className="text-sm text-muted-foreground">{admin.email}</p>
                              </div>
                            </div>
                            <div className="flex gap-6 text-sm">
                              <div className="text-center">
                                <p className="text-2xl font-bold text-green-600">{admin.resolved_count || 0}</p>
                                <p className="text-muted-foreground">Resolved</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-bold text-blue-600">
                                  {admin.avg_resolution_hours ? Math.round(admin.avg_resolution_hours) : '-'}h
                                </p>
                                <p className="text-muted-foreground">Avg Resolution</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No admin performance data available</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Assign Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Complaint #{selectedComplaint?.id}</DialogTitle>
            <DialogDescription>
              Select an admin to assign this complaint to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
              <SelectTrigger>
                <SelectValue placeholder="Select an admin" />
              </SelectTrigger>
              <SelectContent>
                {admins.filter(a => a.status === 'active').map((admin) => (
                  <SelectItem key={admin.id} value={admin.id.toString()}>
                    {admin.name || admin.email} ({admin.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignComplaint} disabled={!selectedAdmin}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Complaint Details #{selectedComplaint?.id}</DialogTitle>
          </DialogHeader>
          {selectedComplaint && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className={getEscalationColor(selectedComplaint.escalation_level)}>
                  Level {selectedComplaint.escalation_level}
                </Badge>
                <Badge className={getPriorityColor(selectedComplaint.priority)}>
                  {selectedComplaint.priority}
                </Badge>
                <Badge className={getStatusColor(selectedComplaint.status)}>
                  {selectedComplaint.status}
                </Badge>
                <Badge variant="outline">{selectedComplaint.category}</Badge>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-semibold">Description:</h4>
                <p className="text-sm bg-muted p-3 rounded-lg">{selectedComplaint.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Submitted by:</span>
                  <p className="font-medium">{selectedComplaint.name || 'Anonymous'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <p className="font-medium">{selectedComplaint.email || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <p className="font-medium">{formatDate(selectedComplaint.created_at)}</p>
                </div>
                {selectedComplaint.escalated_at && (
                  <div>
                    <span className="text-muted-foreground">Escalated:</span>
                    <p className="font-medium">{formatDate(selectedComplaint.escalated_at)}</p>
                  </div>
                )}
              </div>
              
              {selectedComplaint.problem_image_url && (
                <div>
                  <h4 className="font-semibold mb-2">Attached Image:</h4>
                  <img 
                    src={selectedComplaint.problem_image_url} 
                    alt="Problem" 
                    className="max-w-full h-auto rounded-lg border"
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminDashboard;
