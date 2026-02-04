import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { api, logout } from "@/lib/api";
import { 
  User, 
  Mail, 
  Lock, 
  Bell, 
  LogOut, 
  Eye, 
  EyeOff,
  Shield,
  Loader2,
  CheckCircle
} from "lucide-react";

const UserSettings = () => {
  const { toast } = useToast();
  const userEmail = localStorage.getItem("userEmail") || "";
  const userName = localStorage.getItem("userName") || "";
  
  // Profile state
  const [name, setName] = useState(userName);
  const [email] = useState(userEmail);
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Notifications state
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [complaintUpdates, setComplaintUpdates] = useState(true);
  const [resolutionAlerts, setResolutionAlerts] = useState(true);
  
  // UI state
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load saved preferences
    const savedNotifications = localStorage.getItem("emailNotifications");
    setEmailNotifications(savedNotifications === "true");
    
    const savedComplaintUpdates = localStorage.getItem("complaintUpdates");
    setComplaintUpdates(savedComplaintUpdates !== "false");
    
    const savedResolutionAlerts = localStorage.getItem("resolutionAlerts");
    setResolutionAlerts(savedResolutionAlerts !== "false");
  }, []);

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
        description: "Your profile has been saved to the database.",
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
    
    // Validate passwords
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

    // Validate password strength
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
        description: "Your password has been changed successfully.",
      });
      
      // Clear password fields
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

  const handleNotificationChange = (key: string, value: boolean) => {
    localStorage.setItem(key, String(value));
    
    switch (key) {
      case "emailNotifications":
        setEmailNotifications(value);
        break;
      case "complaintUpdates":
        setComplaintUpdates(value);
        break;
      case "resolutionAlerts":
        setResolutionAlerts(value);
        break;
    }
    
    toast({
      title: value ? "Enabled" : "Disabled",
      description: `Notification preference updated.`,
    });
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <Sidebar role="user" />
        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground mt-2">
                Manage your account settings and preferences
              </p>
            </div>

            {/* Profile Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Update your personal details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      placeholder="Enter your name"
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
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed. Contact support if needed.
                    </p>
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
                        Save Changes
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
                  Change Password
                </CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
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

            {/* Notification Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>
                  Choose how you want to be notified
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive all email notifications
                    </p>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={(checked) => handleNotificationChange("emailNotifications", checked)}
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="font-medium">Complaint Updates</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when your complaint status changes
                    </p>
                  </div>
                  <Switch
                    checked={complaintUpdates}
                    onCheckedChange={(checked) => handleNotificationChange("complaintUpdates", checked)}
                    disabled={!emailNotifications}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="font-medium">Resolution Alerts</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when your complaint is resolved
                    </p>
                  </div>
                  <Switch
                    checked={resolutionAlerts}
                    onCheckedChange={(checked) => handleNotificationChange("resolutionAlerts", checked)}
                    disabled={!emailNotifications}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Account Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LogOut className="h-5 w-5" />
                  Account Actions
                </CardTitle>
                <CardDescription>
                  Manage your session and account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Logging out will end your current session. You'll need to sign in again to access your account.
                  </AlertDescription>
                </Alert>
                <Button variant="destructive" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default UserSettings;
