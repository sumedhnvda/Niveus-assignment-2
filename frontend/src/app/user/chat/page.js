"use client";
import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import ReactMarkdown from "react-markdown";
import Link from "next/link";

const agentMeta = {
  recommender: { icon: "📖", label: "Book Recommender", color: "#8b5cf6" },
  rag_qa: { icon: "🔍", label: "Knowledge Search", color: "#3b82f6" },
  book_request: { icon: "📬", label: "Book Request", color: "#f59e0b" },
  summarizer: { icon: "📝", label: "Summarizer", color: "#06b6d4" },
  moderator: { icon: "🛡️", label: "Moderator", color: "#ef4444" },
  general: { icon: "💬", label: "Assistant", color: "#22c55e" },
  cache: { icon: "⚡", label: "Cached Response", color: "#14b8a6" },
  unknown: { icon: "🤖", label: "AI", color: "#6b7280" },
};

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  const agent = agentMeta[msg.agent_used] || agentMeta.unknown;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: isUser ? "flex-end" : "flex-start",
      marginBottom: 16, animation: "bounce-in 0.3s ease",
    }}>
      {/* Agent indicator */}
      {!isUser && msg.agent_used && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginBottom: 6, marginLeft: 4,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 8, background: `${agent.color}15`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
          }}>{agent.icon}</div>
          <span style={{ fontSize: 11, fontWeight: 600, color: agent.color }}>{agent.label}</span>
        </div>
      )}

      {/* Bubble */}
      <div style={{
        maxWidth: "72%", padding: "14px 18px",
        borderRadius: isUser ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
        background: isUser ? "var(--accent-gradient)" : "white",
        border: isUser ? "none" : "1px solid var(--border)",
        color: isUser ? "white" : "var(--text-primary)",
        fontSize: 14, lineHeight: 1.7, whiteSpace: "normal",
        boxShadow: isUser ? "0 2px 12px rgba(34,197,94,0.2)" : "var(--shadow-xs)",
        wordBreak: "break-word",
      }}>
        {isUser ? msg.content : (
          <ReactMarkdown 
            components={{
              p: ({node, ...props}) => <p style={{ margin: "0 0 10px 0", padding: 0 }} {...props} />,
              ul: ({node, ...props}) => <ul style={{ margin: "0 0 10px 0", paddingLeft: 24 }} {...props} />,
              ol: ({node, ...props}) => <ol style={{ margin: "0 0 10px 0", paddingLeft: 24 }} {...props} />,
              li: ({node, ...props}) => <li style={{ marginBottom: 4 }} {...props} />,
              h1: ({node, ...props}) => <h1 style={{ fontSize: 18, margin: "14px 0 8px 0" }} {...props} />,
              h2: ({node, ...props}) => <h2 style={{ fontSize: 16, margin: "14px 0 8px 0" }} {...props} />,
              h3: ({node, ...props}) => <h3 style={{ fontSize: 15, margin: "12px 0 6px 0", fontWeight: 700 }} {...props} />,
              strong: ({node, ...props}) => <strong style={{ fontWeight: 700, color: "inherit" }} {...props} />
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}
      </div>

      {/* Sources */}
      {msg.sources && msg.sources.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6, marginLeft: 4 }}>
          {msg.sources.map((s, i) => {
            const content = (
              <span key={i} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 10px", background: "rgba(59,130,246,0.08)",
                borderRadius: 8, fontSize: 10, fontWeight: 600, color: "#3b82f6",
                cursor: s.book_id ? "pointer" : "default",
                transition: "background 0.2s"
              }}
              onMouseEnter={e => s.book_id && (e.currentTarget.style.background = "rgba(59,130,246,0.15)")}
              onMouseLeave={e => s.book_id && (e.currentTarget.style.background = "rgba(59,130,246,0.08)")}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                {s.book_title.length > 30 ? s.book_title.slice(0, 30) + "..." : s.book_title}
                {s.page_number ? ` (p.${s.page_number})` : ""}
              </span>
            );
            if (s.book_id) {
              return <Link href={`/user/book/${s.book_id}`} key={i} style={{ textDecoration: "none" }}>{content}</Link>;
            }
            return content;
          })}
        </div>
      )}

      {/* Timestamp */}
      <span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, marginLeft: 4, marginRight: 4 }}>
        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

export default function ChatPage() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const messagesEndRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadSessions = async () => {
    try { setSessions(await api.getChatSessions("global")); }
    catch (e) { console.error(e); }
    finally { setLoadingSessions(false); }
  };

  const loadMessages = async (sessionId) => {
    setActiveSession(sessionId);
    try { setMessages(await api.getSessionMessages(sessionId)); }
    catch (e) { console.error(e); }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput("");
    setSending(true);

    const tempId = "temp-" + Date.now();
    setMessages(prev => [...prev, { id: tempId, role: "user", content: userMessage, created_at: new Date().toISOString() }]);

    try {
      const result = await api.sendMessage(userMessage, activeSession);

      if (!activeSession) {
        setActiveSession(result.session_id);
        loadSessions();
      }

      setMessages(prev => [
        ...prev.filter(m => m.id !== tempId),
        {
          id: result.message_id || ("usr-" + Date.now()), role: "user", content: userMessage,
          created_at: new Date().toISOString(),
        },
        {
          id: "resp-" + Date.now(), role: "assistant", content: result.response,
          agent_used: result.agent_used, sources: result.sources,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setMessages(prev => [...prev.filter(m => m.id !== tempId), { id: "err", role: "assistant", content: `Sorry, something went wrong: ${err.message}. Please try again.`, created_at: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  };

  const startNewChat = () => { setActiveSession(null); setMessages([]); };

  const deleteSession = async (id) => {
    try { await api.deleteSession(id); setSessions(s => s.filter(x => x.id !== id)); if (activeSession === id) startNewChat(); }
    catch (e) { console.error(e); }
  };

  const suggestions = [
    "📖 Recommend me a good sci-fi book",
    "🔍 What are the key themes in...",
    "📝 Can you summarize...",
    "📬 I'm looking for a specific book",
  ];

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, background: "white" }}>
      {/* Sessions sidebar */}
      <div style={{
        width: sidebarOpen ? 280 : 0, 
        borderRight: sidebarOpen ? "1px solid var(--border)" : "none", 
        display: "flex", flexDirection: "column",
        background: "var(--bg-secondary)", 
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
        opacity: sidebarOpen ? 1 : 0,
      }}>
        <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
          <button className="btn btn-primary" style={{ width: "100%", borderRadius: 12 }} onClick={startNewChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Chat
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {loadingSessions ? (
            <div className="flex flex-center" style={{ padding: 24 }}><div className="loading-spinner"></div></div>
          ) : sessions.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: 24 }}>No chat history yet</p>
          ) : sessions.map(s => (
            <div key={s.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px", borderRadius: 12, cursor: "pointer", marginBottom: 2,
                background: activeSession === s.id ? "var(--bg-elevated)" : "transparent",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { if (activeSession !== s.id) e.currentTarget.style.background = "var(--bg-hover)"; }}
              onMouseLeave={e => { if (activeSession !== s.id) e.currentTarget.style.background = "transparent"; }}
              onClick={() => loadMessages(s.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: activeSession === s.id ? 600 : 500,
                  color: activeSession === s.id ? "var(--accent-primary)" : "var(--text-primary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{s.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {new Date(s.updated_at).toLocaleDateString()}
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-muted)", fontSize: 14, padding: 4, opacity: 0.4,
                  borderRadius: 6, transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "var(--danger)"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; e.currentTarget.style.color = "var(--text-muted)"; }}
              >✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "white", position: "relative" }}>
        
        {/* Sidebar Toggle Button */}
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            position: "absolute", top: 16, left: 16, zIndex: 10,
            background: "white", border: "1px solid var(--border)", borderRadius: 8,
            width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--text-secondary)", boxShadow: "var(--shadow-sm)",
            transition: "all 0.2s"
          }}
          title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          onMouseEnter={e => e.currentTarget.style.background = "var(--bg-elevated)"}
          onMouseLeave={e => e.currentTarget.style.background = "white"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {sidebarOpen ? (
              <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></>
            ) : (
              <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
            )}
          </svg>
        </button>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px" }}>
          <div style={{ maxWidth: 800, margin: "0 auto", paddingBottom: 40, height: "100%" }}>
            {messages.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 16 }}>
              <div style={{
                width: 72, height: 72, borderRadius: 24, background: "var(--accent-light)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  <path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                How can I help you?
              </h3>
              <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center", maxWidth: 420, lineHeight: 1.6 }}>
                Ask for book recommendations, question about book content, request new books, or get AI-powered summaries.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
                {suggestions.map(q => (
                  <button key={q} onClick={() => setInput(q.slice(2).trim())}
                    style={{
                      padding: "10px 16px", background: "white", border: "1px solid var(--border)",
                      borderRadius: 14, fontSize: 13, fontWeight: 500, cursor: "pointer",
                      color: "var(--text-secondary)", transition: "all 0.15s", fontFamily: "inherit",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent-primary)"; e.currentTarget.style.background = "var(--accent-light)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "white"; }}
                  >{q}</button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
          )}

          {/* Typing indicator */}
          {sending && (
            <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{
                padding: "14px 20px", borderRadius: "20px 20px 20px 6px",
                background: "white", border: "1px solid var(--border)",
                boxShadow: "var(--shadow-xs)",
              }}>
                <div className="loading-dots"><span></span><span></span><span></span></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div style={{ padding: "12px 32px 24px", background: "white" }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <form onSubmit={handleSend} style={{
              display: "flex", gap: 10, alignItems: "center",
            background: "white", border: "1.5px solid var(--border)",
            borderRadius: 20, padding: "6px 6px 6px 20px",
            boxShadow: "var(--shadow-sm)", transition: "all 0.2s",
          }}>
            <input
              placeholder="Ask about books, get recommendations..."
              value={input} onChange={e => setInput(e.target.value)}
              disabled={sending}
              style={{
                flex: 1, border: "none", outline: "none", fontSize: 14,
                fontFamily: "inherit", color: "var(--text-primary)",
                background: "transparent", padding: "8px 0",
              }}
            />
            <button type="submit" disabled={sending || !input.trim()}
              style={{
                width: 40, height: 40, borderRadius: 14, border: "none",
                background: input.trim() ? "var(--accent-gradient)" : "var(--bg-elevated)",
                color: input.trim() ? "white" : "var(--text-muted)",
                cursor: input.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s", flexShrink: 0,
              }}>
              {sending ? (
                <span className="loading-spinner" style={{ width: 16, height: 16, borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }}></span>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              )}
            </button>
          </form>
          </div>
        </div>
      </div>
    </div>
  );
}
