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
import { api } from "@/lib/api";
import { Search, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const [newRole, setNewRole] = useState('user');

  useEffect(() => {
    // Load users from backend user_roles table
    const load = async () => {
      try {
        const res = await api.getUserRoles();
        // res.data expected to be [{id, email, name, role, status, created_at}, ...]
        const mapped = res.data.map((u: any) => ({
          id: u.id,
          name: u.name || (u.email || "").split('@')[0],
          email: u.email,
          role: u.role || 'user',
          status: u.status || 'active',  // Use actual status from DB
          joinedDate: u.created_at || new Date().toISOString(),
        }));
        setUsers(mapped);
      } catch (error) {
        console.error('Failed to load users:', error);
        // fallback to localStorage if backend unavailable
        const storedUsers = JSON.parse(localStorage.getItem("users") || "[]");
        setUsers(storedUsers);
      }
    };
    load();
    const onStorage = (e: StorageEvent) => { if (e.key === "users") load(); };
    const onFocus = () => load();
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

  const handleUpdateUser = () => {
    if (!selectedUser) return;
    const updatedUsers = users.map(u =>
      u.email === selectedUser.email ? selectedUser : u
    );
    setUsers(updatedUsers);

    // update backend if id exists
    if ((selectedUser as any).id) {
      // Send both role and status to the general update endpoint
      api.updateUser((selectedUser as any).id, { 
        role: selectedUser.role,
        status: selectedUser.status 
      })
        .then((response) => {
          console.log('User updated:', response.data);
          toast({ title: 'User updated', description: 'User has been updated successfully.' });
        })
        .catch((err) => {
          console.error('Failed to update user on backend', err);
          const errorMsg = err.response?.data?.error || 'Failed to update user on backend';
          toast({ title: 'Error', description: errorMsg, variant: 'destructive' });
        });
    } else {
      // fallback to localStorage
      localStorage.setItem("users", JSON.stringify(updatedUsers));
      toast({ title: 'User updated', description: 'User updated locally.' });
    }

    setIsDialogOpen(false);
  };

  const handleCreateUser = async () => {
    if (!newEmail) return toast({ title: 'Email required', description: 'Please enter an email', variant: 'destructive' });
    try {
      const res = await api.createUser({ email: newEmail, role: newRole, status: 'active' });
      const created = res.data;
      setUsers(prev => [{ 
        id: created.id, 
        name: created.name || (created.email||'').split('@')[0], 
        email: created.email, 
        role: created.role, 
        status: created.status || 'active', 
        joinedDate: new Date().toISOString() 
      }, ...prev]);
      setIsAddOpen(false);
      setNewEmail('');
      setNewRole('user');
      toast({ title: 'User created', description: 'New user added successfully.' });
    } catch (err: any) {
      console.error('Failed to create user', err);
      const errorMsg = err.response?.data?.error || 'Failed to create user on backend';
      toast({ title: 'Error', description: errorMsg, variant: 'destructive' });
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
              <Button onClick={handleUpdateUser} className="w-full">
                Save Changes
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
            <DialogDescription>Create a new user with role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
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
              <Button onClick={handleCreateUser}>Create</Button>
              <Button variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
