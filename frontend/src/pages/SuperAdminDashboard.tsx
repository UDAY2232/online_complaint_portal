import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  ArrowUpCircle
} from "lucide-react";

interface EscalatedComplaint {
  id: number;
  category: string;
  description: string;
  priority: string;
  status: string;
  escalation_level: number;
  created_at: string;
  name?: string;
  email?: string;
}


const SuperAdminDashboard = () => {
  const [complaints, setComplaints] = useState<EscalatedComplaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchEscalatedComplaints = async () => {
    setIsLoading(true);
    try {
      const response = await api.getEscalatedComplaints();
      setComplaints(response.data.complaints || []);
    } catch (error: any) {
      console.error('Error fetching escalated complaints:', error);
      toast({
        title: "Error",
        description: "Failed to fetch escalated complaints.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEscalatedComplaints();
  }, []);

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

  // Calculate stats
  const stats = {
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
                <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
                <p className="text-muted-foreground mt-2">
                  Overview of all escalated complaints requiring attention
                </p>
              </div>
              <Button 
                onClick={fetchEscalatedComplaints}
                variant="outline"
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Escalated</p>
                      <p className="text-3xl font-bold">{stats.total}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Level 1</p>
                      <p className="text-3xl font-bold text-yellow-500">{stats.level1}</p>
                    </div>
                    <ArrowUpCircle className="h-8 w-8 text-yellow-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Level 2</p>
                      <p className="text-3xl font-bold text-orange-500">{stats.level2}</p>
                    </div>
                    <ArrowUpCircle className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Level 3+</p>
                      <p className="text-3xl font-bold text-red-600">{stats.level3Plus}</p>
                    </div>
                    <ShieldAlert className="h-8 w-8 text-red-600" />
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
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Escalated Complaints List */}
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
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No escalated complaints found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {complaints.map((complaint) => (
                      <div
                        key={complaint.id}
                        className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
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
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">ID: #{complaint.id}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
