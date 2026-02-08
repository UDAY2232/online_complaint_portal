import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface ComplaintFormProps {
  onSubmit?: (created?: any) => void;
}

const ComplaintForm = ({ onSubmit }: ComplaintFormProps) => {
  const { toast } = useToast();

  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category || !description || !priority) {
      toast({
        title: "Missing fields",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!file) {
      toast({
        title: "Evidence Required",
        description: "Please upload an evidence image for your complaint",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const userEmail = localStorage.getItem("userEmail");

      const formData = new FormData();
      formData.append("category", category);
      formData.append("description", description);
      formData.append("priority", priority);

      if (userEmail) {
        formData.append("email", userEmail);
        formData.append("name", userEmail.split("@")[0]);
        formData.append("is_anonymous", "0");
      } else {
        formData.append("is_anonymous", "1");
      }

      if (file) {
        formData.append("image", file); // ✅ backend expects "image"
      }

      // Use the api module which properly uses VITE_API_URL
      const res = await api.createComplaint(formData);

      toast({
        title: "Complaint submitted",
        description: "Your complaint has been submitted successfully. Check spam folder for email updates.",
      });

      setCategory("");
      setDescription("");
      setPriority("");
      setFile(null);

      onSubmit?.(res.data);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to submit complaint",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* CATEGORY */}
      <div className="space-y-2">
        <Label>Complaint Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="service">Service</SelectItem>
            <SelectItem value="behavior">Behavior</SelectItem>
            <SelectItem value="technical">Technical</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* DESCRIPTION */}
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          required
        />
      </div>

      {/* PRIORITY */}
      <div className="space-y-2">
        <Label>Priority</Label>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger>
            <SelectValue placeholder="Select priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* IMAGE */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1">
          Upload Evidence <span className="text-destructive">*</span>
        </Label>
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Submitting..." : "Submit Complaint"}
      </Button>
    </form>
  );
};

export default ComplaintForm;
