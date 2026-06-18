"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [modLogs, setModLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("users");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [u, m] = await Promise.all([api.getUsers(), api.getModerationLogs().catch(() => [])]);
      setUsers(u); setModLogs(m);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleFlag = async (userId, shouldFlag) => {
    const reason = shouldFlag ? prompt("Flag reason:") : null;
    if (shouldFlag && !reason) return;
    try { await api.flagUser(userId, shouldFlag, reason); loadData(); }
    catch (e) { alert(e.message); }
  };

  const handleToggle = async (userId) => {
    try { await api.toggleUserActive(userId); loadData(); }
    catch (e) { alert(e.message); }
  };

  const handleMakeAdmin = async (userId) => {
    if (!confirm("Promote this user to Admin?")) return;
    try { await api.makeAdmin(userId); loadData(); }
    catch (e) { alert(e.message); }
  };

  if (loading) return <div className="flex flex-center" style={{ minHeight: "60vh" }}><div className="loading-spinner" style={{ width: 32, height: 32 }}></div></div>;

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>User Management</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>Manage users and review moderation logs</p>

      <div style={{ display: "flex", gap: 4, background: "var(--bg-secondary)", borderRadius: 8, padding: 4, marginBottom: 24, width: "fit-content" }}>
        <button style={{ padding: "8px 20px", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 500, background: tab === "users" ? "var(--bg-elevated)" : "transparent", color: tab === "users" ? "var(--text-primary)" : "var(--text-muted)", transition: "all 0.2s" }} onClick={() => setTab("users")}>👥 Users ({users.length})</button>
        <button style={{ padding: "8px 20px", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 500, background: tab === "moderation" ? "var(--bg-elevated)" : "transparent", color: tab === "moderation" ? "var(--text-primary)" : "var(--text-muted)", transition: "all 0.2s" }} onClick={() => setTab("moderation")}>🛡️ Moderation ({modLogs.length})</button>
      </div>

      {tab === "users" && (
        <div className="table-container">
          <table>
            <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Flagged</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.username}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{u.email}</td>
                  <td><span className={`badge ${u.role === "admin" ? "badge-primary" : "badge-info"}`}>{u.role}</span></td>
                  <td><span className={`badge ${u.is_active ? "badge-success" : "badge-danger"}`}>{u.is_active ? "Active" : "Inactive"}</span></td>
                  <td>
                    {u.is_flagged ? (
                      <span className="badge badge-danger" title={u.flag_reason}>⚠ {u.flag_reason?.slice(0, 20)}</span>
                    ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="flex gap-sm">
                      {u.role !== "admin" && (
                        <>
                          <button className={`btn btn-sm ${u.is_flagged ? "btn-success" : "btn-danger"}`}
                            onClick={() => handleFlag(u.id, !u.is_flagged)}>
                            {u.is_flagged ? "Unflag" : "Flag"}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleToggle(u.id)}>
                            {u.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button className="btn btn-primary btn-sm" onClick={() => handleMakeAdmin(u.id)}>
                            Make Admin
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "moderation" && (
        <div className="table-container">
          <table>
            <thead><tr><th>Time</th><th>User</th><th>Message</th><th>Type</th><th>Severity</th><th>Action</th><th>Reviewed</th></tr></thead>
            <tbody>
              {modLogs.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No moderation logs</td></tr>
              ) : modLogs.map((l) => (
                <tr key={l.id}>
                  <td style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{new Date(l.created_at).toLocaleString()}</td>
                  <td style={{ fontWeight: 500 }}>{l.username}</td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{l.message}</td>
                  <td><span className="badge badge-warning">{l.flag_type}</span></td>
                  <td><span className={`badge ${l.severity === "high" ? "badge-danger" : l.severity === "medium" ? "badge-warning" : "badge-info"}`}>{l.severity}</span></td>
                  <td style={{ fontSize: 13 }}>{l.action_taken}</td>
                  <td>
                    {l.reviewed_by_admin ? <span className="badge badge-success">✓</span> :
                      <button className="btn btn-secondary btn-sm" onClick={async () => { await api.reviewModerationLog(l.id); loadData(); }}>Review</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
