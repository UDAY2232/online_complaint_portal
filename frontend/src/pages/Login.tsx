import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");

const handleLogin = (e: React.FormEvent) => {
  e.preventDefault();

  const ADMIN_EMAIL = "admin@example.com"; // 👈 only this email is admin

  let assignedRole: "user" | "admin" = "user";

  if (email === ADMIN_EMAIL) {
    assignedRole = "admin";
  }

  // Mock auth (demo purpose)
  localStorage.setItem("token", "mock-token");
  localStorage.setItem("role", assignedRole);
  localStorage.setItem("userEmail", email);

  toast({
    title: "Login successful",
    description:
      assignedRole === "admin"
        ? "Welcome Admin"
        : "Welcome User",
  });

  if (assignedRole === "admin") {
    navigate("/admin/dashboard");
  } else {
    navigate("/user/dashboard");
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Select Role</Label>
              <RadioGroup value={role} onValueChange={(value) => setRole(value as "user" | "admin")}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="user" id="user" />
                  <Label htmlFor="user" className="font-normal cursor-pointer">User</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="admin" id="admin" />
                  <Label htmlFor="admin" className="font-normal cursor-pointer">Admin</Label>
                </div>
              </RadioGroup>
            </div>
            <Button type="submit" className="w-full">
              Login
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
