"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [bookStats, setBookStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [analytics, books] = await Promise.all([
        api.getAnalyticsSummary(30).catch(() => null),
        api.getBooks().catch(() => []),
      ]);
      setStats(analytics);
      setBookStats({ total: books.length, processed: books.filter(b => b.is_processed).length, withPdf: books.filter(b => b.has_pdf).length });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex flex-center" style={{ minHeight: "60vh" }}><div className="loading-spinner" style={{ width: 32, height: 32 }}></div></div>;

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Overview of your library and AI system</p>
      </div>

      <div className="grid-4" style={{ marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-label">📚 Total Books</div>
          <div className="stat-value">{bookStats?.total || 0}</div>
          <div className="stat-sub">{bookStats?.withPdf || 0} with PDFs</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">🤖 AI Queries Today</div>
          <div className="stat-value">{stats?.queries_today || 0}</div>
          <div className="stat-sub">{stats?.tokens_today || 0} tokens used</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">📊 Total Queries (30d)</div>
          <div className="stat-value">{stats?.total_queries || 0}</div>
          <div className="stat-sub">{stats?.total_tokens?.toLocaleString() || 0} total tokens</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">✅ Processed for RAG</div>
          <div className="stat-value">{bookStats?.processed || 0}</div>
          <div className="stat-sub">Books vectorized</div>
        </div>
      </div>

      {stats?.agent_breakdown && Object.keys(stats.agent_breakdown).length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>🎯 Agent Usage Breakdown</h3>
          <div className="grid-3">
            {Object.entries(stats.agent_breakdown).map(([agent, data]) => (
              <div key={agent} style={{ padding: 16, background: "var(--bg-secondary)", borderRadius: 10 }}>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4, textTransform: "capitalize" }}>{agent.replace("_", " ")}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{data.queries}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{data.tokens.toLocaleString()} tokens</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats?.top_users && stats.top_users.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>👥 Top Users by Token Usage</h3>
          <div className="table-container">
            <table>
              <thead><tr><th>User</th><th>Queries</th><th>Tokens</th></tr></thead>
              <tbody>
                {stats.top_users.map((u, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{u.username}</td>
                    <td>{u.queries}</td>
                    <td>{u.tokens.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
