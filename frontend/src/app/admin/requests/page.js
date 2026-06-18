"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function AdminRequests() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadRequests(); }, []);

  const loadRequests = async () => {
    try { setRequests(await api.getBookRequests(filter || null)); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const updateRequest = async (id, status) => {
    const notes = status === "rejected" ? prompt("Reason for rejection (optional):") : null;
    try { await api.updateBookRequest(id, status, notes); loadRequests(); }
    catch (e) { alert(e.message); }
  };

  if (loading) return <div className="flex flex-center" style={{ minHeight: "60vh" }}><div className="loading-spinner" style={{ width: 32, height: 32 }}></div></div>;

  return (
    <div>
      <div className="flex flex-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Book Requests</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Books requested by users that aren't in the library</p>
        </div>
        <select className="select" style={{ width: 150 }} value={filter} onChange={e => { setFilter(e.target.value); setTimeout(loadRequests, 100); }}>
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {requests.length === 0 ? (
        <div className="empty-state"><div className="icon">📬</div><h3>No book requests</h3><p>When users ask for books not in the library, requests will appear here.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {requests.map((r) => (
            <div className="card" key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{r.book_title}</div>
                {r.author && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>by {r.author}</div>}
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Requested by <strong>{r.username}</strong> — {new Date(r.created_at).toLocaleDateString()}</div>
                {r.reason && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, fontStyle: "italic" }}>"{r.reason}"</div>}
                {r.admin_notes && <div style={{ fontSize: 12, color: "var(--warning)", marginTop: 4 }}>Admin: {r.admin_notes}</div>}
              </div>
              <div className="flex gap-sm" style={{ alignItems: "center" }}>
                <span className={`badge ${r.status === "pending" ? "badge-warning" : r.status === "fulfilled" ? "badge-success" : r.status === "rejected" ? "badge-danger" : "badge-info"}`}>
                  {r.status}
                </span>
                {r.status === "pending" && (
                  <>
                    <button className="btn btn-success btn-sm" onClick={() => updateRequest(r.id, "approved")}>Approve</button>
                    <button className="btn btn-danger btn-sm" onClick={() => updateRequest(r.id, "rejected")}>Reject</button>
                  </>
                )}
                {r.status === "approved" && (
                  <button className="btn btn-primary btn-sm" onClick={() => updateRequest(r.id, "fulfilled")}>Mark Fulfilled</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
