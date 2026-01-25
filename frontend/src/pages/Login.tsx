import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Loader2, Eye, EyeOff } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Check if already logged in and redirect
  useEffect(() => {
    const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
    const userRole = localStorage.getItem("userRole");
    
    if (isAuthenticated && userRole) {
      if (userRole === "admin" || userRole === "superadmin") {
        navigate("/admin/dashboard", { replace: true });
      } else {
        navigate("/user/dashboard", { replace: true });
      }
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await api.login(email, password);
      const { accessToken, refreshToken, user } = response.data;

      // ✅ CRITICAL: Clear ALL previous session data first
      localStorage.clear();
      sessionStorage.clear();

      console.log("🔐 Login successful for:", user.email, "Role:", user.role);

      // Store ONLY current user's authentication data
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("userEmail", user.email);
      localStorage.setItem("userName", user.name || "");
      localStorage.setItem("userRole", user.role);
      localStorage.setItem("userId", user.id.toString());

      toast({
        title: "Login successful",
        description: user.role === "admin" || user.role === "superadmin" 
          ? "Welcome Admin!" 
          : "Welcome back!",
      });

      // Redirect based on role (use replace to prevent back navigation)
      if (user.role === "admin" || user.role === "superadmin") {
        navigate("/admin/dashboard", { replace: true });
      } else {
        navigate("/user/dashboard", { replace: true });
      }
    } catch (err: any) {
      console.error("Login error:", err);
      const backendError = err.response?.data?.error;
      let errorMessage = "Login failed. Please check your credentials.";
      let errorTitle = "Login failed";
      
      // Provide more helpful error messages
      if (err.response?.status === 401) {
        errorMessage = "Invalid email or password. Please try again or use 'Forgot password?' if you've forgotten your credentials.";
      } else if (err.response?.status === 400) {
        errorMessage = backendError || "Please enter both email and password.";
      } else if (err.response?.status === 500) {
        errorMessage = "Server error. Please try again later.";
        errorTitle = "Server error";
      } else if (!err.response) {
        errorMessage = "Unable to connect to server. Please check your internet connection.";
        errorTitle = "Connection error";
      } else if (backendError) {
        errorMessage = backendError;
      }
      
      toast({
        variant: "destructive",
        title: errorTitle,
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Login</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Button
                  variant="link"
                  className="p-0 h-auto text-xs"
                  onClick={() => navigate("/forgot-password")}
                  type="button"
                >
                  Forgot password?
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2 text-sm">
            <p className="text-muted-foreground">
              Don't have an account?{" "}
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => navigate("/signup")}
              >
                Sign up
              </Button>
            </p>

            <p className="text-muted-foreground">
              Or{" "}
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => navigate("/anonymous")}
              >
                submit anonymously
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
