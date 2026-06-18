"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function AdminAnalytics() {
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState({ agent: "", user: "" });
  const [loading, setLoading] = useState(true);
  const [bookAnalytics, setBookAnalytics] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [s, l, ba] = await Promise.all([
        api.getAnalyticsSummary(30).catch(() => null),
        api.getLLMUsage(null, null, 50).catch(() => []),
        api.getBookAnalytics().catch(() => null),
      ]);
      setSummary(s);
      setLogs(l);
      setBookAnalytics(ba);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const filterLogs = async () => {
    try { setLogs(await api.getLLMUsage(filter.agent || null, filter.user || null, 50)); }
    catch (e) { console.error(e); }
  };

  if (loading) return <div className="flex flex-center" style={{ minHeight: "60vh" }}><div className="loading-spinner" style={{ width: 32, height: 32 }}></div></div>;

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>LLM Analytics</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>Monitor AI agent usage, token consumption, and book analytics</p>

      {summary && (
        <div className="grid-4" style={{ marginBottom: 28 }}>
          <div className="stat-card"><div className="stat-label">Total Queries</div><div className="stat-value">{summary.total_queries}</div></div>
          <div className="stat-card"><div className="stat-label">Total Tokens</div><div className="stat-value">{summary.total_tokens?.toLocaleString()}</div></div>
          <div className="stat-card"><div className="stat-label">Today's Queries</div><div className="stat-value">{summary.queries_today}</div></div>
          <div className="stat-card"><div className="stat-label">Today's Tokens</div><div className="stat-value">{summary.tokens_today?.toLocaleString()}</div></div>
        </div>
      )}

      {summary?.daily_trend?.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>📉 7-Day Trend</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
            {summary.daily_trend.map((d, i) => {
              const maxQ = Math.max(...summary.daily_trend.map(x => x.queries), 1);
              const h = Math.max((d.queries / maxQ) * 100, 4);
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.queries}</span>
                  <div style={{ width: "100%", height: h, background: "var(--accent-gradient)", borderRadius: 4, minHeight: 4, transition: "height 0.3s" }}></div>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {bookAnalytics && (
        <div className="grid-3" style={{ marginBottom: 24 }}>
          {[
            { title: "🔥 Most Viewed Books", data: bookAnalytics.most_viewed },
            { title: "🔍 Most Searched Books", data: bookAnalytics.most_searched },
            { title: "📖 Most Read Books", data: bookAnalytics.most_read },
          ].map(({ title, data }) => (
            <div className="card" key={title}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{title}</h3>
              {data?.length > 0 ? data.slice(0, 5).map((b, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{b.title}</span>
                  <span className="badge badge-primary">{b.count}</span>
                </div>
              )) : <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No data yet</p>}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="flex flex-between" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>🤖 LLM Usage Logs</h3>
          <div className="flex gap-sm">
            <select className="select" style={{ width: 150 }} value={filter.agent} onChange={e => setFilter({...filter, agent: e.target.value})}>
              <option value="">All Agents</option>
              {["supervisor", "recommender", "rag_qa", "book_request", "moderator", "summarizer", "general"].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={filterLogs}>Filter</button>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>Time</th><th>User</th><th>Agent</th><th>Query</th><th>Tokens</th><th>Latency</th><th>Status</th></tr></thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>No logs yet</td></tr>
              ) : logs.map((l) => (
                <tr key={l.id}>
                  <td style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{new Date(l.created_at).toLocaleString()}</td>
                  <td style={{ fontWeight: 500 }}>{l.username}</td>
                  <td><span className="badge badge-info">{l.agent_name}</span></td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{l.query}</td>
                  <td>{l.total_tokens}</td>
                  <td style={{ fontSize: 12 }}>{l.latency_ms}ms</td>
                  <td><span className={`badge ${l.status === "success" ? "badge-success" : "badge-danger"}`}>{l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
