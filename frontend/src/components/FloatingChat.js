"use client";
import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import ReactMarkdown from "react-markdown";

const agentMeta = {
  recommender: { icon: "📖", color: "#8b5cf6" },
  rag_qa: { icon: "🔍", color: "#3b82f6" },
  book_request: { icon: "📬", color: "#f59e0b" },
  summarizer: { icon: "📝", color: "#06b6d4" },
  moderator: { icon: "🛡️", color: "#ef4444" },
  general: { icon: "💬", color: "#22c55e" },
  cache: { icon: "⚡", color: "#14b8a6" },
  unknown: { icon: "🤖", color: "#6b7280" },
};

function MiniMessage({ msg }) {
  const isUser = msg.role === "user";
  const agent = agentMeta[msg.agent_used] || agentMeta.unknown;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: isUser ? "flex-end" : "flex-start",
      marginBottom: 12, animation: "slideUp 0.2s ease",
    }}>
      <div style={{
        maxWidth: "85%", padding: "10px 14px",
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        background: isUser ? "var(--accent-gradient)" : "var(--bg-elevated)",
        color: isUser ? "white" : "var(--text-primary)",
        fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap",
        boxShadow: isUser ? "0 2px 8px rgba(34,197,94,0.2)" : "none",
        wordBreak: "break-word",
        border: isUser ? "none" : "1px solid var(--border)",
      }}>
        {!isUser && msg.agent_used && (
          <div style={{ fontSize: 10, color: agent.color, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
            {agent.icon} {msg.agent_used.replace("_", " ").toUpperCase()}
          </div>
        )}
        {isUser ? msg.content : (
          <ReactMarkdown 
            components={{
              p: ({node, ...props}) => <p style={{ margin: "0 0 8px 0", padding: 0 }} {...props} />,
              ul: ({node, ...props}) => <ul style={{ margin: "0 0 8px 0", paddingLeft: 20 }} {...props} />,
              ol: ({node, ...props}) => <ol style={{ margin: "0 0 8px 0", paddingLeft: 20 }} {...props} />,
              li: ({node, ...props}) => <li style={{ marginBottom: 4 }} {...props} />,
              h1: ({node, ...props}) => <h1 style={{ fontSize: 16, margin: "10px 0 6px 0" }} {...props} />,
              h2: ({node, ...props}) => <h2 style={{ fontSize: 14, margin: "10px 0 6px 0" }} {...props} />,
              h3: ({node, ...props}) => <h3 style={{ fontSize: 13, margin: "8px 0 4px 0", fontWeight: 700 }} {...props} />,
              strong: ({node, ...props}) => <strong style={{ fontWeight: 700, color: "inherit" }} {...props} />
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}
        {msg.sources && msg.sources.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {msg.sources.slice(0, 3).map((s, i) => {
              const content = (
                <span key={i} style={{ 
                  display: "inline-flex", alignItems: "center", gap: 3,
                  fontSize: 10, padding: "3px 8px", background: "rgba(59,130,246,0.1)", 
                  color: "#3b82f6", borderRadius: 6, fontWeight: 600,
                  transition: "background 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(59,130,246,0.2)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(59,130,246,0.1)"}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                  {s.book_title.length > 20 ? s.book_title.slice(0, 20) + "..." : s.book_title}
                </span>
              );
              return s.book_id ? (
                <Link href={`/user/book/${s.book_id}`} key={i} style={{ textDecoration: "none" }}>
                  {content}
                </Link>
              ) : <span key={i}>{content}</span>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  
  const pathname = usePathname();
  const router = useRouter();
  const messagesEndRef = useRef(null);

  // Extract book ID from URL context if we are on a book page
  const match = pathname?.match(/\/user\/book\/([a-zA-Z0-9_-]+)/);
  const currentBookId = match ? match[1] : "global";

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    const loadLatestSession = async () => {
      try {
        if (currentBookId === "global") {
          setSessionId(null);
          setMessages([]);
          return;
        }

        const sessions = await api.getChatSessions(currentBookId);
        if (sessions && sessions.length > 0) {
          const latest = sessions[0];
          setSessionId(latest.id);
          const msgs = await api.getSessionMessages(latest.id);
          setMessages(msgs || []);
        } else {
          setSessionId(null);
          setMessages([]);
        }
      } catch (err) {
        console.error("Failed to load chat history", err);
      }
    };
    loadLatestSession();
  }, [currentBookId]);

  const handleNewChat = () => {
    setSessionId(null);
    setMessages([]);
  };


  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput("");
    setSending(true);

    if (!isOpen) setIsOpen(true);

    setMessages(prev => [...prev, { id: "temp", role: "user", content: userMessage }]);

    try {
      const result = await api.sendMessage(userMessage, sessionId, currentBookId);
      
      if (!sessionId) {
        setSessionId(result.session_id);
      }

      setMessages(prev => [
        ...prev.filter(m => m.id !== "temp"),
        { id: "usr-" + Date.now(), role: "user", content: userMessage },
        {
          id: "resp-" + Date.now(), role: "assistant", content: result.response,
          agent_used: result.agent_used, sources: result.sources,
        },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev.filter(m => m.id !== "temp"),
        { id: "usr-" + Date.now(), role: "user", content: userMessage },
        { id: "err", role: "assistant", content: `Error: ${err.message}` }
      ]);
    } finally {
      setSending(false);
    }
  };

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, lastX: 0, lastY: 0 });

  const handlePointerDown = (e) => {
    // Only drag from the header area, not buttons
    if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('button') || isMaximized) return;
    setIsDragging(true);
    e.target.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, lastX: position.x, lastY: position.y };
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPosition({ x: dragRef.current.lastX + dx, y: dragRef.current.lastY + dy });
  };

  const handlePointerUp = (e) => {
    if (isDragging) {
      setIsDragging(false);
      e.target.releasePointerCapture(e.pointerId);
    }
  };

  if (pathname === "/user/chat") return null;

  return (
    <>
      
      {/* Chat Window Container (Handles Drag Transform) */}
      {isOpen && (
        <div style={isMaximized ? {
          position: "fixed", top: 20, left: 20, right: 20, bottom: 20, zIndex: 999,
          transform: "none", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        } : {
          position: "fixed",
          top: "calc(100vh - 740px)",
          left: "calc(100vw - 520px)",
          zIndex: 999,
          transform: `translate(${position.x}px, ${position.y}px)`,
          transition: isDragging ? "none" : "transform 0.1s",
        }}>
          <div style={isMaximized ? {
            width: "100%", height: "100%", background: "white", borderRadius: 24,
            boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          } : {
            width: 480, height: 700, minWidth: 300, minHeight: 400, maxWidth: "90vw", maxHeight: "90vh",
            background: "white", borderRadius: 24,
            boxShadow: isDragging ? "0 16px 48px rgba(0,0,0,0.2)" : "var(--shadow-lg)", 
            border: "1px solid var(--border)",
            display: "flex", flexDirection: "column", overflow: "hidden",
            animation: "slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            resize: "both",
          }}>
            {/* Header (Draggable) */}
          <div 
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              padding: "16px 20px", background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border)", display: "flex",
              alignItems: "center", justifyContent: "space-between",
              cursor: isDragging ? "grabbing" : "grab",
              userSelect: "none", touchAction: "none",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: "var(--accent-gradient)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "white", boxShadow: "0 2px 8px rgba(34,197,94,0.3)" }}>
                ✨
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>AI Assistant</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={handleNewChat} style={{
                background: "white", border: "1px solid var(--border)", borderRadius: 8,
                width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "var(--text-muted)", transition: "all 0.15s"
              }} title="New Chat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              </button>
              <button onClick={() => setIsMaximized(!isMaximized)} style={{
                background: "white", border: "1px solid var(--border)", borderRadius: 8,
                width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "var(--text-muted)", transition: "all 0.15s"
              }} title={isMaximized ? "Restore" : "Maximize"}>
                {isMaximized ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                )}
              </button>
              <button onClick={() => setIsOpen(false)} style={{
                background: "white", border: "1px solid var(--border)", borderRadius: 8,
                width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "var(--text-muted)", transition: "all 0.15s"
              }} title="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 10px" }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.8 }}>💬</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                  How can I help you?
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {currentBookId 
                    ? "Ask me anything about the book you're currently viewing."
                    : "Ask for book recommendations, summaries, or questions about any book in our library."}
                </p>
                {currentBookId && (
                  <button onClick={() => setInput("Can you explain the main themes of this book?")}
                    style={{ marginTop: 16, padding: "6px 12px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 100, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
                    "Explain the main themes..."
                  </button>
                )}
              </div>
            ) : (
              messages.map(m => <MiniMessage key={m.id} msg={m} />)
            )}
            {sending && (
              <div style={{ padding: "10px 14px", borderRadius: "16px 16px 16px 4px", background: "var(--bg-elevated)", border: "1px solid var(--border)", display: "inline-block", marginBottom: 12 }}>
                <div className="loading-dots"><span></span><span></span><span></span></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
            <form onSubmit={handleSend} style={{ display: "flex", gap: 8 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 12,
                  border: "1.5px solid var(--border)", background: "var(--bg-surface)",
                  fontSize: 13, fontFamily: "inherit", outline: "none",
                  transition: "all 0.2s"
                }}
                onFocus={e => e.target.style.borderColor = "var(--accent-primary)"}
                onBlur={e => e.target.style.borderColor = "var(--border)"}
              />
              <button type="submit" disabled={sending || !input.trim()} style={{
                width: 38, height: 38, borderRadius: 12, border: "none",
                background: input.trim() ? "var(--accent-gradient)" : "var(--bg-elevated)",
                color: input.trim() ? "white" : "var(--text-muted)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: input.trim() ? "pointer" : "default", transition: "all 0.2s"
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </form>
          </div>
          </div>
        </div>
      )}

      {/* Bubble Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 999,
            width: 64, height: 64, borderRadius: "50%",
            background: "var(--accent-gradient)", color: "white",
            border: "none", cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px rgba(34,197,94,0.35)",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05) translateY(-4px)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1) translateY(0)"; }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            <path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/>
          </svg>
        </button>
      )}
    </>
  );
}
