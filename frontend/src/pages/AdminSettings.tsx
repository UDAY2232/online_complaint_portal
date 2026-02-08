import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { api, logout } from "@/lib/api";
import { 
  User, 
  Mail, 
  Lock, 
  Settings, 
  LogOut, 
  Eye, 
  EyeOff,
  Shield,
  Loader2,
  CheckCircle,
  Server,
  Bell,
  AlertTriangle,
  Users,
  FileText,
  Clock,
  Database,
  Zap
} from "lucide-react";

interface SystemStats {
  totalUsers: number;
  totalComplaints: number;
  pendingComplaints: number;
  resolvedComplaints: number;
}

const AdminSettings = () => {
  const { toast } = useToast();
  const location = useLocation();
  const isSuperAdmin = location.pathname.startsWith('/superadmin');
  const sidebarRole = isSuperAdmin ? 'superadmin' : 'admin';
  const adminEmail = localStorage.getItem("userEmail") || "";
  const adminName = localStorage.getItem("userName") || "Admin";
  
  // Profile state
  const [name, setName] = useState(adminName);
  const [email] = useState(adminEmail);
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // System settings state
  const [autoEscalation, setAutoEscalation] = useState(true);
  const [defaultPriority, setDefaultPriority] = useState("medium");
  const [escalationDays, setEscalationDays] = useState("3");
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  
  // System stats
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    totalComplaints: 0,
    pendingComplaints: 0,
    resolvedComplaints: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  
  // UI state
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load saved system settings
    const savedAutoEscalation = localStorage.getItem("adminAutoEscalation");
    setAutoEscalation(savedAutoEscalation !== "false");
    
    const savedDefaultPriority = localStorage.getItem("adminDefaultPriority");
    if (savedDefaultPriority) setDefaultPriority(savedDefaultPriority);
    
    const savedEscalationDays = localStorage.getItem("adminEscalationDays");
    if (savedEscalationDays) setEscalationDays(savedEscalationDays);
    
    const savedEmailNotifications = localStorage.getItem("adminEmailNotifications");
    setEmailNotificationsEnabled(savedEmailNotifications !== "false");
    
    // Fetch system stats
    fetchSystemStats();
  }, []);

  const fetchSystemStats = async () => {
    setIsLoadingStats(true);
    try {
      // Fetch users
      const usersRes = await api.getUserRoles();
      const users = usersRes.data || [];
      
      // Fetch complaints
      const complaintsRes = await api.getComplaints();
      const complaints = complaintsRes.data || [];
      
      setStats({
        totalUsers: users.length,
        totalComplaints: complaints.length,
        pendingComplaints: complaints.filter((c: any) => c.status === "new" || c.status === "under-review").length,
        resolvedComplaints: complaints.filter((c: any) => c.status === "resolved").length,
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      // Save display name to database (not just localStorage)
      const response = await api.updateProfile({ displayName: name });
      
      // Update localStorage with the new name
      if (response.data?.user?.name) {
        localStorage.setItem("userName", response.data.user.name);
      }
      
      // If new token is returned, update it
      if (response.data?.accessToken) {
        localStorage.setItem("accessToken", response.data.accessToken);
      }
      
      toast({
        title: "Profile updated",
        description: "Your admin profile has been saved to the database.",
      });
    } catch (error: any) {
      console.error("Profile update error:", error);
      
      // Fallback to localStorage only if API fails
      if (name) {
        localStorage.setItem("userName", name);
      }
      
      toast({
        title: "Warning",
        description: error.response?.data?.error || "Profile saved locally. Server sync may have failed.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirm password must match.",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      toast({
        title: "Weak password",
        description: "Password must contain uppercase, lowercase, and a number.",
        variant: "destructive",
      });
      return;
    }
    
    setIsChangingPassword(true);
    
    try {
      await api.changePassword(currentPassword, newPassword);
      
      toast({
        title: "Password changed",
        description: "Your admin password has been changed successfully.",
      });
      
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      const message = error.response?.data?.error || "Failed to change password.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSystemSettingChange = (key: string, value: string | boolean) => {
    localStorage.setItem(key, String(value));
    
    switch (key) {
      case "adminAutoEscalation":
        setAutoEscalation(value as boolean);
        break;
      case "adminDefaultPriority":
        setDefaultPriority(value as string);
        break;
      case "adminEscalationDays":
        setEscalationDays(value as string);
        break;
      case "adminEmailNotifications":
        setEmailNotificationsEnabled(value as boolean);
        break;
    }
    
    toast({
      title: "Setting updated",
      description: "System configuration has been saved.",
    });
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <Sidebar role={sidebarRole} />
        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold">Admin Settings</h1>
              <p className="text-muted-foreground mt-2">
                Manage system settings and admin account
              </p>
            </div>

            {/* System Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  System Overview
                </CardTitle>
                <CardDescription>
                  Current system statistics (read-only)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingStats ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 border rounded-lg text-center">
                      <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                      <p className="text-2xl font-bold">{stats.totalUsers}</p>
                      <p className="text-sm text-muted-foreground">Total Users</p>
                    </div>
                    <div className="p-4 border rounded-lg text-center">
                      <FileText className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                      <p className="text-2xl font-bold">{stats.totalComplaints}</p>
                      <p className="text-sm text-muted-foreground">Total Complaints</p>
                    </div>
                    <div className="p-4 border rounded-lg text-center">
                      <Clock className="h-6 w-6 mx-auto mb-2 text-yellow-600" />
                      <p className="text-2xl font-bold">{stats.pendingComplaints}</p>
                      <p className="text-sm text-muted-foreground">Pending</p>
                    </div>
                    <div className="p-4 border rounded-lg text-center">
                      <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-600" />
                      <p className="text-2xl font-bold">{stats.resolvedComplaints}</p>
                      <p className="text-sm text-muted-foreground">Resolved</p>
                    </div>
                  </div>
                )}
                <Button 
                  variant="outline" 
                  className="mt-4" 
                  onClick={fetchSystemStats}
                  disabled={isLoadingStats}
                >
                  {isLoadingStats ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="mr-2 h-4 w-4" />
                  )}
                  Refresh Stats
                </Button>
              </CardContent>
            </Card>

            {/* Admin Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Admin Profile
                </CardTitle>
                <CardDescription>
                  Your admin account details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      placeholder="Admin name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        className="pl-10 bg-muted"
                        disabled
                        readOnly
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        <Shield className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        Email cannot be changed for security reasons.
                      </p>
                    </div>
                  </div>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Save Profile
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Change Admin Password
                </CardTitle>
                <CardDescription>
                  Keep your admin account secure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Must be 8+ characters with uppercase, lowercase, and number
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <Button type="submit" disabled={isChangingPassword}>
                    {isChangingPassword ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Changing Password...
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Change Password
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Complaint System Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Complaint System Settings
                </CardTitle>
                <CardDescription>
                  Configure complaint handling behavior
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-600" />
                      <p className="font-medium">Auto-Escalation</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Automatically escalate unresolved complaints
                    </p>
                  </div>
                  <Switch
                    checked={autoEscalation}
                    onCheckedChange={(checked) => handleSystemSettingChange("adminAutoEscalation", checked)}
                  />
                </div>

                {autoEscalation && (
                  <div className="pl-6 space-y-4 border-l-2 border-yellow-200">
                    <div className="space-y-2">
                      <Label htmlFor="escalationDays">Escalation Period (Days)</Label>
                      <Select 
                        value={escalationDays} 
                        onValueChange={(value) => handleSystemSettingChange("adminEscalationDays", value)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select days" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 day</SelectItem>
                          <SelectItem value="2">2 days</SelectItem>
                          <SelectItem value="3">3 days</SelectItem>
                          <SelectItem value="5">5 days</SelectItem>
                          <SelectItem value="7">7 days</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Complaints will be escalated after this many days without resolution
                      </p>
                    </div>
                  </div>
                )}
                
                <Separator />
                
                <div className="space-y-2">
                  <Label htmlFor="defaultPriority">Default Priority for New Complaints</Label>
                  <Select 
                    value={defaultPriority} 
                    onValueChange={(value) => handleSystemSettingChange("adminDefaultPriority", value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Default priority assigned to new complaints if not specified
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Email Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Email Configuration
                </CardTitle>
                <CardDescription>
                  Email notification system status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">SMTP Server Status</p>
                      <p className="text-sm text-muted-foreground">SendGrid / Nodemailer</p>
                    </div>
                  </div>
                  <Badge variant={emailNotificationsEnabled ? "default" : "secondary"}>
                    {emailNotificationsEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      <p className="font-medium">System Email Notifications</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Send email notifications for complaint updates
                    </p>
                  </div>
                  <Switch
                    checked={emailNotificationsEnabled}
                    onCheckedChange={(checked) => handleSystemSettingChange("adminEmailNotifications", checked)}
                  />
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Email configuration is managed through environment variables. Contact your system administrator to modify SMTP settings.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Account Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <LogOut className="h-5 w-5" />
                  Account Actions
                </CardTitle>
                <CardDescription>
                  Manage your admin session
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Logging out will end your admin session. You'll need to sign in again with admin credentials.
                  </AlertDescription>
                </Alert>
                <Button variant="destructive" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout Admin
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminSettings;
