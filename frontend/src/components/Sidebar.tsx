import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Home, FileText, BarChart3, Settings, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

interface SidebarProps {
  role: "user" | "admin";
}

const Sidebar = ({ role }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const userLinks = [
    { label: "Dashboard", path: "/user/dashboard", icon: Home },
    { label: "My Complaints", path: "/user/dashboard", icon: FileText },
    { label: "Track Status", path: "/user/status", icon: TrendingUp },
    { label: "Settings", path: "/user/settings", icon: Settings },
  ];

  const adminLinks = [
    { label: "Dashboard", path: "/admin/dashboard", icon: Home },
    { label: "All Complaints", path: "/admin/complaints", icon: FileText },
    { label: "Escalations", path: "/admin/escalations", icon: AlertTriangle },
    { label: "Reports", path: "/admin/reports", icon: BarChart3 },
    { label: "Users", path: "/admin/users", icon: Users },
  ];

  const links = role === "admin" ? adminLinks : userLinks;

  return (
    <aside className="w-64 border-r bg-card min-h-screen">
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="space-y-1">
            {links.map((link) => (
              <Button
                key={link.path}
                variant={location.pathname === link.path ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  location.pathname === link.path && "bg-secondary"
                )}
                onClick={() => navigate(link.path)}
              >
                <link.icon className="mr-2 h-4 w-4" />
                {link.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
