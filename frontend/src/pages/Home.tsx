import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield,
  FileCheck,
  TrendingUp,
  Bell,
  CheckCircle2,
  Users,
} from "lucide-react";

const Home = () => {
  const navigate = useNavigate();

  // ✅ STEP-3: AUTO REDIRECT BASED ON ROLE
  useEffect(() => {
    const isAuth = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (isAuth && role === "admin") {
      navigate("/admin/dashboard", { replace: true });
      return;
    }

    if (isAuth && role === "user") {
      navigate("/user/dashboard", { replace: true });
      return;
    }
  }, []); // Empty dependency array - only run once on mount

  const outcomes = [
    { icon: Shield, text: "Anonymous or verified complaint submission" },
    { icon: FileCheck, text: "Status tracking & escalation system" },
    { icon: TrendingUp, text: "Admin dashboard for resolutions" },
    { icon: Bell, text: "Reports and analytics" },
  ];

  const features = [
    {
      icon: CheckCircle2,
      title: "Easy Submission",
      description: "Submit complaints in minutes with our simple form",
    },
    {
      icon: Bell,
      title: "Real-time Updates",
      description: "Get notified when your complaint status changes",
    },
    {
      icon: Users,
      title: "Expert Resolution",
      description: "Dedicated admins work to resolve your issues",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-5xl mx-auto space-y-12">
          <Card className="shadow-2xl border-primary/10">
            <CardContent className="p-8 md:p-12 text-center space-y-8">
              <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full">
                <Shield className="h-8 w-8 text-primary" />
              </div>

              <h1 className="text-4xl md:text-6xl font-bold">
                Online Complaint & <br /> Grievance Portal
              </h1>

              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Submit complaints with confidence, track progress, and ensure swift resolution.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" onClick={() => navigate("/login")}>
                  Login / Signup
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("/anonymous")}
                >
                  Submit Anonymously
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <Card key={i} className="hover:shadow-lg">
                <CardContent className="p-6 text-center space-y-3">
                  <f.icon className="mx-auto h-6 w-6 text-primary" />
                  <h3 className="font-bold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-center mb-6">
                What You Can Expect
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {outcomes.map((o, i) => (
                  <div key={i} className="flex gap-3">
                    <o.icon className="h-5 w-5 text-primary" />
                    <p>{o.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Home;
