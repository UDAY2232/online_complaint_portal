import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api, classifyError } from "@/lib/api";
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { AxiosError } from "axios";

const Signup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password validation states
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
  });

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

  // Validate password on change
  useEffect(() => {
    setPasswordValidation({
      minLength: password.length >= 6,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
    });
  }, [password]);

  const isPasswordValid = Object.values(passwordValidation).every(Boolean);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Password mismatch",
        description: "Passwords do not match. Please try again.",
      });
      return;
    }

    if (!isPasswordValid) {
      toast({
        variant: "destructive",
        title: "Weak password",
        description: "Please meet all password requirements.",
      });
      return;
    }

    setIsLoading(true);

    try {
      await api.signup(email, password, name);

      toast({
        title: "Account created successfully!",
        description: "You can now log in with your credentials. Check spam folder for any confirmation emails.",
      });

      navigate("/login");
    } catch (err: any) {
      console.error("Signup error:", err);
      
      // Check for network errors first
      if (err instanceof AxiosError && !err.response) {
        const classified = classifyError(err);
        console.error("Classified error:", classified);
        toast({
          variant: "destructive",
          title: "Connection Error",
          description: classified.message,
        });
        return;
      }
      
      const errorMessage = err.response?.data?.error || "Signup failed. Please try again.";
      
      // Check if user already exists
      if (err.response?.status === 409) {
        toast({
          variant: "destructive",
          title: "Account already exists",
          description: "An account with this email already exists. Please login instead.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Signup failed",
          description: errorMessage,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const ValidationItem = ({ valid, text }: { valid: boolean; text: string }) => (
    <div className={`flex items-center gap-2 text-xs ${valid ? "text-green-600" : "text-muted-foreground"}`}>
      {valid ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {text}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Sign Up</CardTitle>
          <CardDescription>
            Create an account to submit and track complaints
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
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
              <Label htmlFor="password">Password</Label>
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
              {/* Password requirements */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1 p-2 bg-muted rounded-md">
                  <ValidationItem valid={passwordValidation.minLength} text="At least 6 characters" />
                  <ValidationItem valid={passwordValidation.hasUppercase} text="One uppercase letter" />
                  <ValidationItem valid={passwordValidation.hasLowercase} text="One lowercase letter" />
                  <ValidationItem valid={passwordValidation.hasNumber} text="One number" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className={confirmPassword.length > 0 ? (passwordsMatch ? "border-green-500" : "border-red-500") : ""}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !isPasswordValid || !passwordsMatch}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Sign Up"
              )}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">
              Already have an account?{" "}
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => navigate("/login")}
              >
                Login
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
