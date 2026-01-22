import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logout } from "@/lib/api";

const Navbar = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const userName = localStorage.getItem("userName") || localStorage.getItem("userEmail") || "User";
  const userRole = localStorage.getItem("userRole") || "user";

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
            <User className="h-4 w-4" />
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
