import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { api, classifyError } from "@/lib/api";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AxiosError } from "axios";

interface User {
  name: string;
  email: string;
  role: string;
  status: string;
  joinedDate: string;
  id?: number;
}

const AdminUsers = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const res = await api.getUserRoles();
      const mapped = res.data.map((u: any) => ({
        id: u.id,
        name: u.name || (u.email || "").split('@')[0],
        email: u.email,
        role: u.role || 'user',
        status: u.status || 'active',
        joinedDate: u.created_at || new Date().toISOString(),
      }));
      setUsers(mapped);
    } catch (error: any) {
      console.error('Failed to load users:', error);
      const errorInfo = error instanceof AxiosError ? classifyError(error) : { message: error.message };
      toast({ 
        title: 'Error loading users', 
        description: errorInfo.message || 'Failed to load users from server', 
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    const onStorage = (e: StorageEvent) => { if (e.key === "users") loadUsers(); };
    const onFocus = () => loadUsers();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    return role === "admin" 
      ? "bg-primary text-primary-foreground" 
      : "bg-secondary text-secondary-foreground";
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success text-success-foreground";
      case "inactive":
        return "bg-muted text-muted-foreground";
      case "suspended":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleManageUser = (user: User) => {
    setSelectedUser(user);
    setIsDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    
    setIsUpdating(true);
    try {
      // Use PATCH method for partial updates (id must exist)
      if ((selectedUser as any).id) {
        const response = await api.updateUser((selectedUser as any).id, { 
          role: selectedUser.role,
          status: selectedUser.status 
        });
        console.log('User updated:', response.data);
        
        // Update local state with response data
        if (response.data.user) {
          setUsers(users.map(u =>
            u.email === selectedUser.email ? { 
              ...u, 
              ...response.data.user,
              name: response.data.user.name || u.name 
            } : u
          ));
        } else {
          // Fallback to local state update
          setUsers(users.map(u =>
            u.email === selectedUser.email ? selectedUser : u
          ));
        }
        
        toast({ title: 'User updated', description: 'User has been updated successfully.' });
      } else {
        toast({ title: 'Error', description: 'User ID not found', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error('Failed to update user on backend', err);
      const errorInfo = err instanceof AxiosError ? classifyError(err) : { message: err.message };
      const errorMsg = err.response?.data?.error || errorInfo.message || 'Failed to update user';
      toast({ title: 'Error', description: errorMsg, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
      setIsDialogOpen(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newEmail) {
      return toast({ title: 'Email required', description: 'Please enter an email', variant: 'destructive' });
    }
    
    setIsCreating(true);
    try {
      const res = await api.createUser({ 
        email: newEmail, 
        password: newPassword || undefined,
        name: newName || undefined,
        role: newRole, 
        status: 'active' 
      });
      const created = res.data;
      
      // Add new user to list
      setUsers(prev => [{ 
        id: created.id, 
        name: created.name || newName || (created.email||'').split('@')[0], 
        email: created.email, 
        role: created.role, 
        status: created.status || 'active', 
        joinedDate: new Date().toISOString() 
      }, ...prev]);
      
      // Reset form
      setIsAddOpen(false);
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewRole('user');
      
      toast({ title: 'User created', description: `New user ${created.email} added successfully.` });
    } catch (err: any) {
      console.error('Failed to create user', err);
      const errorInfo = err instanceof AxiosError ? classifyError(err) : { message: err.message };
      const errorMsg = err.response?.data?.error || errorInfo.message || 'Failed to create user';
      toast({ title: 'Error', description: errorMsg, variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <Sidebar role="admin" />
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">User Management</h1>
                <p className="text-muted-foreground mt-2">
                  View and manage registered users
                </p>
              </div>
              <Button onClick={() => setIsAddOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Search Users</CardTitle>
                <CardDescription>Find users by email address</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Registered Users ({filteredUsers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredUsers.map((user, index) => (
                    <div
                      key={index}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-1 flex-1">
                        <p className="font-medium">{user.email}</p>
                        <p className="text-sm text-muted-foreground">
                          Joined: {new Date(user.joinedDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 mt-3 md:mt-0">
                        <Badge className={getRoleBadgeColor(user.role)}>
                          {user.role}
                        </Badge>
                        <Badge className={getStatusBadgeColor(user.status)}>
                          {user.status}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={() => handleManageUser(user)}>
                          Manage
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage User</DialogTitle>
            <DialogDescription>Update user role and status</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={selectedUser.name} disabled />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={selectedUser.email} disabled />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={selectedUser.role}
                  onValueChange={(value) => setSelectedUser({ ...selectedUser, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={selectedUser.status}
                  onValueChange={(value) => setSelectedUser({ ...selectedUser, status: value })}
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
              <Button onClick={handleUpdateUser} className="w-full" disabled={isUpdating}>
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
      {/* Add User Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new user account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input 
                value={newEmail} 
                onChange={(e) => setNewEmail(e.target.value)} 
                placeholder="user@example.com"
                type="email"
              />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)} 
                placeholder="Full Name (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                placeholder="Leave empty for random password"
                type="password"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateUser} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create"
                )}
              </Button>
              <Button variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
