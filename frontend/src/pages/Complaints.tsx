import { useEffect, useState } from "react";
import { getComplaints } from "../integrations/complaints";

export default function Complaints() {
  const [complaints, setComplaints] = useState<any[]>([]);

  useEffect(() => {
    getComplaints().then(setComplaints);
  }, []);

  return (
    <div>
      <h1>Complaints</h1>
      {complaints.map(c => (
        <div key={c.id}>
          <h3>{c.category}</h3>
          <p>{c.description}</p>
          <p>Status: {c.status}</p>
        </div>
      ))}
    </div>
  );
}
