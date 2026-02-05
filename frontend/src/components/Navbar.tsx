import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { LogOut, User, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logout, api } from "@/lib/api";

const Navbar = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Start with localStorage values, then sync with backend
  const [userName, setUserName] = useState(localStorage.getItem("userName") || localStorage.getItem("userEmail") || "User");
  const [userRole, setUserRole] = useState(localStorage.getItem("userRole") || "user");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch fresh profile from backend on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        if (!token) return;

        setIsLoading(true);
        const response = await api.fetchProfile();
        const user = response.data.user;
        
        if (user) {
          // Update localStorage with fresh data from DB
          const displayName = user.displayName || user.name || "";
          localStorage.setItem("userName", displayName);
          localStorage.setItem("userRole", user.role);
          localStorage.setItem("userEmail", user.email);
          
          // Update state
          setUserName(displayName || user.email || "User");
          setUserRole(user.role);
          
          console.log("📋 Profile synced from DB:", { name: displayName, role: user.role });
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        // Keep using localStorage values on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = () => {
    toast({
      title: "Logged out",
      description: "You have been logged out successfully.",
    });
    
    logout();
  };

  return (
    <nav className="border-b bg-card">
      <div className="flex h-16 items-center px-6 justify-between">
        <h1 className="text-xl font-bold text-primary">Complaint Portal</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <User className="h-4 w-4" />
            )}
            <span>{userName}</span>
            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs capitalize">
              {userRole}
            </span>
          </div>
          <Button variant="ghost" onClick={handleLogout} size="sm">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
