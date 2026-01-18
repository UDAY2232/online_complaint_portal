import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Navbar = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userEmail");
    
    toast({
      title: "Logged out",
      description: "You have been logged out successfully.",
    });
    
    navigate("/login");
  };

  return (
    <nav className="border-b bg-card">
      <div className="flex h-16 items-center px-6 justify-between">
        <h1 className="text-xl font-bold text-primary">Complaint Portal</h1>
        <Button variant="ghost" onClick={handleLogout} size="sm">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </nav>
  );
};

export default Navbar;
