"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import api from "@/lib/api";
import FloatingChat from "@/components/FloatingChat";

const navItems = [
  { label: "Library", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
  ), path: "/user" },
  { label: "AI Chat", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  ), path: "/user/chat" },
];

export default function UserLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = api.getUser();
    if (!u) { router.push("/"); return; }
    setUser(u);
  }, [router]);

  const handleLogout = () => { api.clearToken(); router.push("/"); };

  if (!user) return null;

  const initials = user.username?.slice(0, 2).toUpperCase() || "U";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", height: pathname.startsWith("/user/chat") ? "100vh" : "auto" }}>
      <header className="top-nav">
        <div className="top-nav-logo">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "var(--accent-gradient)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: "var(--accent-secondary)", letterSpacing: "-0.03em" }}>Niveus Library</h1>
            </div>
          </div>
        </div>
        
        <nav className="top-nav-links">
          {navItems.map((item) => {
            const isActive = pathname === item.path || (item.path === "/user" && pathname.startsWith("/user/book"));
            return (
              <button key={item.path}
                className={`top-nav-link ${isActive ? "active" : ""}`}
                onClick={() => router.push(item.path)}>
                <span className="icon">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="top-nav-actions">
          <div className="top-nav-user" style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 8, borderRight: "1px solid var(--border)" }}>
            <div className="avatar avatar-green" style={{ width: 36, height: 36, fontSize: 13, boxShadow: "0 2px 4px rgba(34, 197, 94, 0.2)" }}>{initials}</div>
            <div className="user-info" style={{ display: "flex", flexDirection: "column", maxWidth: 160 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.username}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={handleLogout} title="Sign out" style={{ marginLeft: 8, color: "var(--text-muted)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </header>
      
      <main className={pathname.startsWith("/user/chat") ? "main-content-chat" : "main-content-top"}>{children}</main>
      <FloatingChat />
    </div>
  );
}
