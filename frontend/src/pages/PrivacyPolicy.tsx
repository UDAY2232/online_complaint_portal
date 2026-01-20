import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background p-4">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Privacy Policy</CardTitle>
            <p className="text-muted-foreground">Last updated: January 20, 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <h2 className="text-xl font-semibold mt-6 mb-3">1. Introduction</h2>
            <p className="text-muted-foreground mb-4">
              Welcome to the Online Complaint Portal ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our complaint portal service.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">2. Information We Collect</h2>
            <p className="text-muted-foreground mb-2">We collect information that you provide directly to us:</p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4">
              <li>Personal identification information (name, email address)</li>
              <li>Account credentials (password - stored securely hashed)</li>
              <li>Complaint details and descriptions</li>
              <li>Images uploaded with complaints</li>
              <li>Communication preferences</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-3">3. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-2">We use the information we collect to:</p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4">
              <li>Process and manage your complaints</li>
              <li>Send you updates about your complaint status</li>
              <li>Communicate with you about our services</li>
              <li>Improve our services and user experience</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-3">4. Anonymous Complaints</h2>
            <p className="text-muted-foreground mb-4">
              We offer the option to submit complaints anonymously. When you choose this option, we do not collect or store your personal identification information with the complaint. However, this means we cannot provide you with status updates via email.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">5. Data Security</h2>
            <p className="text-muted-foreground mb-4">
              We implement appropriate technical and organizational security measures to protect your personal information, including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4">
              <li>Encryption of data in transit (HTTPS/SSL)</li>
              <li>Secure password hashing using bcrypt</li>
              <li>Regular security assessments</li>
              <li>Access controls and authentication</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-3">6. Data Retention</h2>
            <p className="text-muted-foreground mb-4">
              We retain your personal information for as long as necessary to fulfill the purposes outlined in this privacy policy, unless a longer retention period is required by law. Complaint records are typically retained for 7 years for legal and administrative purposes.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">7. Your Rights</h2>
            <p className="text-muted-foreground mb-2">You have the right to:</p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to processing of your data</li>
              <li>Data portability</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-3">8. Third-Party Services</h2>
            <p className="text-muted-foreground mb-4">
              We use third-party services for image storage (Cloudinary) and email delivery. These services have their own privacy policies and we recommend reviewing them.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">9. Cookies</h2>
            <p className="text-muted-foreground mb-4">
              We use essential cookies to maintain your session and authentication status. We do not use tracking or advertising cookies.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">10. Changes to This Policy</h2>
            <p className="text-muted-foreground mb-4">
              We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page and updating the "Last updated" date.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">11. Contact Us</h2>
            <p className="text-muted-foreground mb-4">
              If you have questions about this Privacy Policy, please contact us at:<br />
              <strong>Email:</strong> complaintportals@gmail.com
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
