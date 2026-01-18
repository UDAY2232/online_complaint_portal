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
import axios from "axios";

interface ComplaintFormProps {
  onSubmit?: (created?: any) => void;
}

const ComplaintForm = ({ onSubmit }: ComplaintFormProps) => {
  const { toast } = useToast();

  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  try {
    const userEmail = localStorage.getItem("userEmail");

    const formData = new FormData();
    formData.append("category", category);
    formData.append("description", description);
    formData.append("priority", priority);
    formData.append("email", userEmail || "");
    formData.append("name", userEmail ? userEmail.split("@")[0] : "");
    formData.append("is_anonymous", (!userEmail).toString());

    if (file) {
      formData.append("file", file); // 🔥 must be "file"
    }

    const res = await api.createComplaint(formData);

    toast({
      title: "Complaint submitted",
      description: "Complaint submitted successfully",
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
  }
};


  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Complaint Category</Label>
        <Select value={category} onValueChange={setCategory} required>
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

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={6}
        />
      </div>

      <div className="space-y-2">
        <Label>Priority</Label>
        <Select value={priority} onValueChange={setPriority} required>
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

      <div className="space-y-2">
        <Label>Upload Evidence (Optional)</Label>
        <Input
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>

      <Button type="submit" className="w-full">
        Submit Complaint
      </Button>
    </form>
  );
};

export default ComplaintForm;
