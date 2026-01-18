import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Complaints() {
  const [complaints, setComplaints] = useState<any[]>([]);

  useEffect(() => {
    api.getComplaints()
      .then((res) => setComplaints(res.data || []))
      .catch(() => setComplaints([]));
  }, []);

  return (
    <div>
      <h1>Complaints</h1>
      {complaints.map(c => (
        <div key={c.id}>
          <h3>{c.category || 'Unknown Category'}</h3>
          <p>{c.description || 'No description'}</p>
          <p>Status: {c.status || 'Unknown'}</p>
          {/* Only show resolution info when status is resolved and fields exist */}
          {c.status === "resolved" && c.resolution_message && (
            <p>Resolution: {c.resolution_message}</p>
          )}
          {c.status === "resolved" && c.resolved_image_url && (
            <img src={c.resolved_image_url} alt="Resolution" className="max-w-[200px]" />
          )}
        </div>
      ))}
    </div>
  );
}
