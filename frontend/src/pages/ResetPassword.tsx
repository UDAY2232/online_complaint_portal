import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { ArrowLeft, Loader2, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Password validation
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && passwordsMatch;
  
  // State for error message display
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorCode, setErrorCode] = useState<string>("");

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setIsVerifying(false);
        setErrorMessage("No reset token provided. Please request a new password reset link.");
        setErrorCode("MISSING_TOKEN");
        return;
      }

      try {
        const response = await api.verifyResetToken(token);
        console.log("🔑 Token verification response:", response.data);
        setIsValidToken(response.data.valid);
        setErrorMessage("");
        setErrorCode("");
      } catch (error: any) {
        console.error("🔑 Token verification error:", error.response?.data || error.message);
        setIsValidToken(false);
        const code = error.response?.data?.code || "UNKNOWN_ERROR";
        setErrorCode(code);
        
        // Set user-friendly error message based on error code
        switch (code) {
          case "TOKEN_EXPIRED":
            setErrorMessage("This reset link has expired. Please request a new password reset.");
            break;
          case "TOKEN_USED":
            setErrorMessage("This reset link has already been used. Please request a new password reset.");
            break;
          case "INVALID_TOKEN":
            setErrorMessage("This reset link is invalid. Please request a new password reset.");
            break;
          default:
            setErrorMessage(error.response?.data?.error || "Unable to verify reset link. Please try again.");
        }
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isPasswordValid) {
      toast({
        title: "Invalid password",
        description: "Please ensure your password meets all requirements.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.resetPassword(token!, password);
      console.log("🔑 Password reset response:", response.data);
      setIsSuccess(true);
      toast({
        title: "Password Reset Successful",
        description: "You can now login with your new password.",
      });
    } catch (error: any) {
      console.error("🔑 Password reset error:", error.response?.data || error.message);
      const code = error.response?.data?.code || "UNKNOWN_ERROR";
      let errorMsg = error.response?.data?.error || "Failed to reset password";
      
      // Handle specific error codes
      switch (code) {
        case "TOKEN_EXPIRED":
          errorMsg = "This reset link has expired. Please request a new password reset.";
          break;
        case "TOKEN_USED":
          errorMsg = "This reset link has already been used. Please request a new password reset.";
          break;
        case "INVALID_TOKEN":
          errorMsg = "This reset link is invalid. Please request a new password reset.";
          break;
        case "WEAK_PASSWORD":
          errorMsg = "Password is too weak. Please use at least 8 characters with uppercase, lowercase, and a number.";
          break;
      }
      
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="py-10 text-center">
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Verifying reset link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token || !isValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {errorCode === "TOKEN_EXPIRED" ? "Link Expired" : 
               errorCode === "TOKEN_USED" ? "Link Already Used" : 
               "Invalid Reset Link"}
            </CardTitle>
            <CardDescription className="text-base">
              {errorMessage || "This password reset link is invalid or has expired."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate("/forgot-password")}
              className="w-full"
            >
              Request a new link
            </Button>
            <Button
              variant="link"
              onClick={() => navigate("/login")}
              className="w-full mt-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Password Reset!</CardTitle>
            <CardDescription>
              Your password has been successfully reset.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/login")} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription>
            Create a new password for your account.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
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
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {/* Password requirements */}
            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <p className="font-medium">Password Requirements:</p>
              <div className={`flex items-center gap-2 ${hasMinLength ? "text-green-600" : "text-muted-foreground"}`}>
                {hasMinLength ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                At least 8 characters
              </div>
              <div className={`flex items-center gap-2 ${hasUppercase ? "text-green-600" : "text-muted-foreground"}`}>
                {hasUppercase ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                One uppercase letter
              </div>
              <div className={`flex items-center gap-2 ${hasLowercase ? "text-green-600" : "text-muted-foreground"}`}>
                {hasLowercase ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                One lowercase letter
              </div>
              <div className={`flex items-center gap-2 ${hasNumber ? "text-green-600" : "text-muted-foreground"}`}>
                {hasNumber ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                One number
              </div>
              <div className={`flex items-center gap-2 ${passwordsMatch ? "text-green-600" : "text-muted-foreground"}`}>
                {passwordsMatch ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                Passwords match
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || !isPasswordValid}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
