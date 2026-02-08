import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { BarChart3, Download, TrendingUp, FileText, Clock } from "lucide-react";
import { api } from "@/lib/api";

const AdminReports = () => {
  const [complaints, setComplaints] = useState<any[]>([]);
  const location = useLocation();
  const isSuperAdmin = location.pathname.startsWith('/superadmin');
  const sidebarRole = isSuperAdmin ? 'superadmin' : 'admin';

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.getComplaints();
        const data = res.data;
        // normalize created_at -> date for compatibility with existing UI
        const normalized = data.map((c: any) => ({ ...c, date: c.date || c.created_at }));
        // Reports should reflect user-raised complaints only
        setComplaints(normalized.filter((c: any) => !c.is_anonymous));
      } catch (error) {
        console.error('Failed to load complaints for reports, falling back to localStorage', error);
        const stored = JSON.parse(localStorage.getItem("complaints") || "[]");
        setComplaints(stored);
      }
    };
    load();
  }, []);

  const stats = {
    total: complaints.length,
    new: complaints.filter(c => c.status === "new").length,
    underReview: complaints.filter(c => c.status === "under-review").length,
    resolved: complaints.filter(c => c.status === "resolved").length,
  };

  const categoryStats = complaints.reduce((acc: any, complaint) => {
    const category = complaint.category || "other";
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  const priorityStats = complaints.reduce((acc: any, complaint) => {
    const priority = complaint.priority || "low";
    acc[priority] = (acc[priority] || 0) + 1;
    return acc;
  }, {});

  const exportToCSV = () => {
    const headers = ["ID", "Category", "Priority", "Status", "Date", "Description"];
    const rows = complaints.map(c => [
      c.id,
      c.category,
      c.priority,
      c.status,
      new Date(c.date).toLocaleDateString(),
      c.description
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `complaints-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Complaints Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; }
            .stats { display: flex; gap: 20px; margin: 20px 0; }
            .stat-card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>Complaints Report</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          
          <div class="stats">
            <div class="stat-card">
              <h3>Total: ${stats.total}</h3>
            </div>
            <div class="stat-card">
              <h3>New: ${stats.new}</h3>
            </div>
            <div class="stat-card">
              <h3>Under Review: ${stats.underReview}</h3>
            </div>
            <div class="stat-card">
              <h3>Resolved: ${stats.resolved}</h3>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${complaints.map(c => `
                <tr>
                  <td>${c.id}</td>
                  <td>${c.category}</td>
                  <td>${c.priority}</td>
                  <td>${c.status}</td>
                  <td>${new Date(c.date).toLocaleDateString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <Sidebar role={sidebarRole} />
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">Reports & Analytics</h1>
                <p className="text-muted-foreground mt-2">
                  View complaint statistics and trends
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => exportToCSV()}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button variant="outline" onClick={() => exportToPDF()}>
                  <Download className="mr-2 h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Complaints</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <p className="text-xs text-muted-foreground">All time</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">New</CardTitle>
                  <Clock className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{stats.new}</div>
                  <p className="text-xs text-muted-foreground">Awaiting review</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Under Review</CardTitle>
                  <TrendingUp className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">{stats.underReview}</div>
                  <p className="text-xs text-muted-foreground">In progress</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                  <BarChart3 className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">{stats.resolved}</div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Complaints by Category</CardTitle>
                  <CardDescription>Distribution across different categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(categoryStats).map(([category, count]: [string, any]) => (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize font-medium">{category}</span>
                          <span className="text-muted-foreground">{count} complaints</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{
                              width: `${(count / stats.total) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {Object.keys(categoryStats).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No data available yet
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Complaints by Priority</CardTitle>
                  <CardDescription>Distribution by priority levels</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(priorityStats).map(([priority, count]: [string, any]) => (
                      <div key={priority} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize font-medium">{priority}</span>
                          <span className="text-muted-foreground">{count} complaints</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              priority === "high"
                                ? "bg-destructive"
                                : priority === "medium"
                                ? "bg-warning"
                                : "bg-success"
                            }`}
                            style={{
                              width: `${(count / stats.total) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {Object.keys(priorityStats).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No data available yet
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Resolution Rate</CardTitle>
                <CardDescription>Percentage of resolved complaints</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">
                      {stats.total > 0
                        ? Math.round((stats.resolved / stats.total) * 100)
                        : 0}
                      %
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {stats.resolved} of {stats.total} resolved
                    </span>
                  </div>
                  <div className="h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-success transition-all"
                      style={{
                        width: `${stats.total > 0 ? (stats.resolved / stats.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminReports;
