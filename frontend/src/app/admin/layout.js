"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import api from "@/lib/api";

const navItems = [
  { label: "Dashboard", icon: "📊", path: "/admin" },
  { label: "Books", icon: "📚", path: "/admin/books" },
  { label: "Analytics", icon: "📈", path: "/admin/analytics" },
  { label: "Book Requests", icon: "📬", path: "/admin/requests" },
  { label: "Users", icon: "👥", path: "/admin/users" },
];

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = api.getUser();
    if (!u || u.role !== "admin") {
      router.push("/");
      return;
    }
    setUser(u);
  }, [router]);

  const handleLogout = () => {
    api.clearToken();
    router.push("/");
  };

  if (!user) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header className="top-nav">
        <div className="top-nav-logo">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "var(--accent-gradient)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 16 }}>🛡️</span>
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>Niveus Admin</h1>
            </div>
          </div>
        </div>
        
        <nav className="top-nav-links">
          {navItems.map((item) => (
            <button key={item.path}
              className={`top-nav-link ${pathname === item.path ? "active" : ""}`}
              onClick={() => router.push(item.path)}>
              <span className="icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="top-nav-actions">
          <div className="top-nav-user" style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 8, borderRight: "1px solid var(--border)" }}>
            <div className="user-info" style={{ display: "flex", flexDirection: "column", maxWidth: 160, textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.username}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Admin Panel</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={handleLogout} title="Sign out" style={{ marginLeft: 8, color: "var(--text-muted)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </header>
      
      <main className="main-content-top">{children}</main>
    </div>
  );
}
