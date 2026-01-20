import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const TermsOfService = () => {
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
            <CardTitle className="text-3xl font-bold">Terms of Service</CardTitle>
            <p className="text-muted-foreground">Last updated: January 20, 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <h2 className="text-xl font-semibold mt-6 mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground mb-4">
              By accessing or using the Online Complaint Portal ("Service"), you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not access the Service.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground mb-4">
              The Online Complaint Portal is a platform that allows users to submit, track, and manage complaints related to public services including road infrastructure, water supply, electricity, sanitation, and public safety issues.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">3. User Accounts</h2>
            <p className="text-muted-foreground mb-2">When creating an account, you agree to:</p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your password</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized use</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-3">4. Acceptable Use</h2>
            <p className="text-muted-foreground mb-2">You agree NOT to:</p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4">
              <li>Submit false or misleading complaints</li>
              <li>Harass, abuse, or harm other users or staff</li>
              <li>Upload malicious content or malware</li>
              <li>Attempt to gain unauthorized access to the system</li>
              <li>Use the service for any illegal purpose</li>
              <li>Submit spam or duplicate complaints</li>
              <li>Impersonate others or misrepresent your identity</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-3">5. Complaint Submission</h2>
            <p className="text-muted-foreground mb-4">
              When submitting a complaint, you certify that the information provided is accurate to the best of your knowledge. False or malicious complaints may result in account suspension and potential legal action.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">6. Content Ownership</h2>
            <p className="text-muted-foreground mb-4">
              By submitting content (including images and descriptions), you grant us a non-exclusive, royalty-free license to use, store, and display this content for the purpose of processing and resolving complaints.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">7. Service Level Agreements</h2>
            <p className="text-muted-foreground mb-4">
              We strive to address complaints within the following timeframes based on priority:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4">
              <li><strong>High Priority:</strong> 24 hours</li>
              <li><strong>Medium Priority:</strong> 48 hours</li>
              <li><strong>Low Priority:</strong> 72 hours</li>
            </ul>
            <p className="text-muted-foreground mb-4">
              These are target response times and not guaranteed resolution times.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">8. Limitation of Liability</h2>
            <p className="text-muted-foreground mb-4">
              The Service is provided "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Service.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">9. Account Termination</h2>
            <p className="text-muted-foreground mb-4">
              We reserve the right to terminate or suspend your account at any time for violations of these terms or for any other reason at our discretion. You may also delete your account at any time through the account settings.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">10. Modifications to Terms</h2>
            <p className="text-muted-foreground mb-4">
              We reserve the right to modify these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">11. Governing Law</h2>
            <p className="text-muted-foreground mb-4">
              These terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law provisions.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">12. Contact Information</h2>
            <p className="text-muted-foreground mb-4">
              For questions about these Terms of Service, please contact us at:<br />
              <strong>Email:</strong> complaintportals@gmail.com
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TermsOfService;
