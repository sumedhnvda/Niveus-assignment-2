"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

const genreColors = {
  "Fiction": "#3b82f6", "Non-Fiction": "#22c55e", "Science": "#8b5cf6",
  "Technology": "#06b6d4", "History": "#f59e0b", "Philosophy": "#ec4899",
  "Self-Help": "#14b8a6", "Biography": "#f97316",
};

function BookCard({ book, onClick }) {
  const color = genreColors[book.genre] || "#22c55e";

  return (
    <div onClick={onClick} style={{
      background: "white", border: "1px solid var(--border)", borderRadius: 20,
      overflow: "hidden", cursor: "pointer", transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
      boxShadow: "var(--shadow-card)",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = "0 12px 36px rgba(0,0,0,0.1)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "var(--shadow-card)"; }}
    >
      {/* Book cover */}
      <div style={{
        height: 180, background: `linear-gradient(135deg, ${color}22, ${color}11)`,
        display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
        borderBottom: "1px solid var(--border-light)",
      }}>
        <div style={{
          width: 80, height: 110, background: `linear-gradient(135deg, ${color}, ${color}cc)`,
          borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `4px 4px 20px ${color}33`, transform: "rotate(-2deg)",
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </div>
        {book.has_pdf && (
          <div style={{
            position: "absolute", top: 12, right: 12, background: "white", borderRadius: 8,
            padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "var(--success)",
            boxShadow: "var(--shadow-sm)", display: "flex", alignItems: "center", gap: 4,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            PDF
          </div>
        )}
      </div>

      {/* Book info */}
      <div style={{ padding: "16px 18px 18px" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{book.title}</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10, fontWeight: 400 }}>{book.author}</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {book.genre && (
            <span style={{
              background: `${color}12`, color: color, padding: "3px 10px",
              borderRadius: 100, fontSize: 11, fontWeight: 600,
            }}>{book.genre}</span>
          )}
          {book.page_count > 0 && (
            <span style={{
              background: "var(--bg-elevated)", color: "var(--text-muted)", padding: "3px 10px",
              borderRadius: 100, fontSize: 11, fontWeight: 500,
            }}>{book.page_count}p</span>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(59,130,246,0.1)", color: "#2563eb", padding: "3px 8px", borderRadius: 100, fontSize: 11, fontWeight: 600 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            {book.total_views || 0}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.1)", color: "#16a34a", padding: "3px 8px", borderRadius: 100, fontSize: 11, fontWeight: 600 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            {book.total_reads || 0}
          </span>
        </div>
        {book.description && (
          <p style={{
            fontSize: 12, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.6,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>{book.description}</p>
        )}
      </div>
    </div>
  );
}

export default function UserLibrary() {
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadBooks(); }, []);

  const loadBooks = async (q = null) => {
    setLoading(true);
    try { setBooks(await api.getBooks(q)); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadBooks(search || null);
  };

  const genres = [...new Set(books.map(b => b.genre).filter(Boolean))];

  return (
    <div>
      <div className="page-header">
        <h1>Library</h1>
        <p>Browse and read books from our collection</p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 520 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input className="input" placeholder="Search books by title, author..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 42, borderRadius: 14 }} />
        </div>
        <button className="btn btn-primary" type="submit" style={{ borderRadius: 14, padding: "10px 24px" }}>Search</button>
        {search && <button className="btn btn-secondary" type="button" onClick={() => { setSearch(""); loadBooks(); }} style={{ borderRadius: 14 }}>Clear</button>}
      </form>

      {/* Genre pills */}
      {genres.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => loadBooks()} style={{ borderRadius: 100 }}>All</button>
          {genres.map(g => (
            <button key={g} className="btn btn-secondary btn-sm" onClick={() => loadBooks(g)}
              style={{ borderRadius: 100 }}>{g}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex flex-center" style={{ minHeight: "40vh" }}>
          <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
        </div>
      ) : books.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📚</div>
          <h3>No books found</h3>
          <p>{search ? "Try a different search term" : "The library is empty. Check back later!"}</p>
        </div>
      ) : (
        <div className="grid-4">
          {books.map((book) => (
            <BookCard key={book.id} book={book} onClick={() => router.push(`/user/book/${book.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
