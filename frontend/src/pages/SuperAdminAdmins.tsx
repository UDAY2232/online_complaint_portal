import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { api, classifyError } from "@/lib/api";
import { Search, Shield, ShieldCheck, Mail, Calendar, User, Loader2, RefreshCw, UserCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AxiosError } from "axios";

interface Admin {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  resolved_count?: number;
  avg_resolution_hours?: number;
}

const SuperAdminAdmins = () => {
  const { toast } = useToast();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadAdmins = async () => {
    setIsLoading(true);
    try {
      const res = await api.getAllAdmins();
      setAdmins(res.data.admins || []);
    } catch (error: any) {
      console.error('Failed to load admins:', error);
      const errorInfo = error instanceof AxiosError ? classifyError(error) : { message: error.message };
      toast({
        title: 'Error loading admins',
        description: errorInfo.message || 'Failed to load admins from server',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const filteredAdmins = admins.filter(admin =>
    admin.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeVariant = (role: string) => {
    return role === "superadmin" ? "default" : "secondary";
  };

  const getRoleIcon = (role: string) => {
    return role === "superadmin" ? ShieldCheck : Shield;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "inactive":
        return "secondary";
      case "suspended":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const handleViewAdmin = (admin: Admin) => {
    setSelectedAdmin(admin);
    setIsDialogOpen(true);
  };

  const handleUpdateAdmin = async () => {
    if (!selectedAdmin) return;

    setIsUpdating(true);
    try {
      await api.updateUser(selectedAdmin.id, {
        status: selectedAdmin.status
      });
      
      setAdmins(admins.map(a => 
        a.id === selectedAdmin.id ? selectedAdmin : a
      ));
      
      toast({ title: 'Admin updated', description: 'Admin status has been updated successfully.' });
      setIsDialogOpen(false);
    } catch (err: any) {
      console.error('Failed to update admin:', err);
      const errorInfo = err instanceof AxiosError ? classifyError(err) : { message: err.message };
      toast({
        title: 'Error',
        description: errorInfo.message || 'Failed to update admin',
        variant: 'destructive'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <Sidebar role="superadmin" />
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <UserCog className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-3xl font-bold">Admin Management</h1>
                  <p className="text-muted-foreground">
                    View and manage all administrators in the system
                  </p>
                </div>
              </div>
              <Button onClick={loadAdmins} variant="outline" disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Admins</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{admins.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Active administrators
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Superadmins</CardTitle>
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {admins.filter(a => a.role === 'superadmin').length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    With full system access
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Regular Admins</CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {admins.filter(a => a.role === 'admin').length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Complaint handlers
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Search */}
            <Card>
              <CardHeader>
                <CardTitle>Search Admins</CardTitle>
                <CardDescription>Find admins by name or email</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Admin List */}
            <Card>
              <CardHeader>
                <CardTitle>Administrator List ({filteredAdmins.length})</CardTitle>
                <CardDescription>All admins and superadmins in the system</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredAdmins.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'No admins found matching your search' : 'No admins found'}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Admin</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAdmins.map((admin) => {
                        const RoleIcon = getRoleIcon(admin.role);
                        return (
                          <TableRow key={admin.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <RoleIcon className="h-4 w-4 text-primary" />
                                </div>
                                <span className="font-medium">
                                  {admin.name || admin.email.split('@')[0]}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {admin.email}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getRoleBadgeVariant(admin.role)}>
                                {admin.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(admin.status)}>
                                {admin.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-muted-foreground text-sm">
                                <Calendar className="h-3 w-3" />
                                {formatDate(admin.created_at)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleViewAdmin(admin)}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Admin Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAdmin && (
                <>
                  {selectedAdmin.role === 'superadmin' ? (
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  ) : (
                    <Shield className="h-5 w-5 text-primary" />
                  )}
                  Admin Details
                </>
              )}
            </DialogTitle>
            <DialogDescription>View and manage administrator information</DialogDescription>
          </DialogHeader>
          {selectedAdmin && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase">Name</Label>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {selectedAdmin.name || selectedAdmin.email.split('@')[0]}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase">Email</Label>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedAdmin.email}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase">Role</Label>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  {selectedAdmin.role === 'superadmin' ? (
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  ) : (
                    <Shield className="h-4 w-4 text-primary" />
                  )}
                  <Badge variant={getRoleBadgeVariant(selectedAdmin.role)}>
                    {selectedAdmin.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase">Joined Date</Label>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDate(selectedAdmin.created_at)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase">Status</Label>
                <Select
                  value={selectedAdmin.status}
                  onValueChange={(value) => 
                    setSelectedAdmin({ ...selectedAdmin, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleUpdateAdmin} 
                className="w-full" 
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminAdmins;
