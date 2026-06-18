"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export default function AdminBooks() {
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editBook, setEditBook] = useState(null);
  
  const [form, setForm] = useState({ title: "", author: "", description: "", genre: "", tags: "" });
  const [selectedFile, setSelectedFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  
  const [uploading, setUploading] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => { loadBooks(); }, []);

  const loadBooks = async () => {
    try { setBooks(await api.getBooks()); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openModal = (book = null) => {
    if (book) {
      setEditBook(book);
      setForm({ title: book.title, author: book.author, description: book.description, genre: book.genre, tags: book.tags?.join(", ") || "" });
      setSelectedFile(null);
    } else {
      setEditBook(null);
      setForm({ title: "", author: "", description: "", genre: "", tags: "" });
      setSelectedFile(null);
    }
    setShowModal(true);
  };

  const handlePdfSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { ...form, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean) };
      
      let bookId;
      if (editBook) { 
        await api.updateBook(editBook.id, data); 
        bookId = editBook.id;
      } else { 
        const newBook = await api.createBook(data); 
        bookId = newBook.id;
      }

      // If a file was selected during creation/edit, upload it now
      if (selectedFile) {
        setUploading(bookId);
        await api.uploadBookPdf(bookId, selectedFile);
      }
      
      setShowModal(false);
      loadBooks();
    } catch (err) { 
      setErrorMsg(err.message); 
    } finally { 
      setSaving(false); 
      setUploading(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this book and its PDF?")) return;
    try { await api.deleteBook(id); loadBooks(); } catch (e) { setErrorMsg(e.message); }
  };

  const handlePdfUpload = async (bookId, file) => {
    setUploading(bookId);
    try { await api.uploadBookPdf(bookId, file); loadBooks(); }
    catch (e) { setErrorMsg(e.message); }
    finally { setUploading(null); }
  };

  const handleAutoFill = async () => {
    setErrorMsg("");
    if (selectedFile) {
      setExtracting(true);
      try {
        const metadata = await api.extractBookMetadata(selectedFile);
        setForm(prev => ({
          ...prev,
          title: metadata.title || prev.title,
          author: metadata.author || prev.author,
          description: metadata.description || prev.description,
          genre: metadata.genre || prev.genre,
          tags: metadata.tags ? metadata.tags.join(", ") : prev.tags
        }));
      } catch (err) {
        setErrorMsg("Could not extract metadata from PDF: " + err.message);
      } finally {
        setExtracting(false);
      }
    } else if (form.title) {
      setGeneratingDesc(true);
      try {
        const res = await api.generateBookDescription(form.title, form.author);
        setForm(prev => ({
          ...prev,
          description: res.description || prev.description,
          genre: res.genre || prev.genre,
          tags: res.tags ? res.tags.join(", ") : prev.tags,
          author: res.author || prev.author
        }));
      } catch (e) {
        setErrorMsg("Failed to generate details: " + e.message);
      } finally {
        setGeneratingDesc(false);
      }
    } else {
      setErrorMsg("Please upload a PDF first, or enter a book title to auto-fill details.");
    }
  };

  if (loading) return <div className="flex flex-center" style={{ minHeight: "60vh" }}><div className="loading-spinner" style={{ width: 32, height: 32 }}></div></div>;

  return (
    <div>
      <div className="flex flex-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Book Management</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{books.length} books in library</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>+ Add Book</button>
      </div>

      {books.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📚</div>
          <h3>No books yet</h3>
          <p>Add your first book to get started with the library.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Title</th><th>Author</th><th>Genre</th><th>PDF</th><th>Status</th><th>Views</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr key={book.id}>
                  <td style={{ fontWeight: 500, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{book.title}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{book.author}</td>
                  <td><span className="badge badge-info">{book.genre || "—"}</span></td>
                  <td>
                    {book.has_pdf ? (
                      <span className="badge badge-success">✓ {book.page_count}p</span>
                    ) : (
                      <label style={{ cursor: "pointer" }}>
                        <span className="badge badge-warning" style={{ cursor: "pointer" }}>
                          {uploading === book.id ? "Uploading..." : "Upload PDF"}
                        </span>
                        <input type="file" accept=".pdf" hidden
                          onChange={(e) => e.target.files[0] && handlePdfUpload(book.id, e.target.files[0])} />
                      </label>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${book.processing_status === "completed" ? "badge-success" : book.processing_status === "failed" ? "badge-danger" : "badge-warning"}`}>
                      {book.processing_status}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>{book.total_views}</td>
                  <td>
                    <div className="flex gap-sm">
                      <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/user/book/${book.id}`)} title="View Book">👁</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => openModal(book)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(book.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ minWidth: 500 }}>
            <div className="flex flex-between" style={{ marginBottom: 24 }}>
              <h2 style={{ marginBottom: 0 }}>{editBook ? "Edit Book" : "Add New Book"}</h2>
              {selectedFile && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAutoFill} disabled={generatingDesc || extracting} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {(generatingDesc || extracting) ? <span className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span> : <span>✨</span>}
                  {extracting ? "Analyzing PDF..." : "Auto-fill with AI"}
                </button>
              )}
            </div>
            
            {errorMsg && (
              <div style={{ padding: 12, background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 8, color: "var(--danger)", fontSize: 13, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{errorMsg}</span>
                <button onClick={() => setErrorMsg("")} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", opacity: 0.7 }}>✕</button>
              </div>
            )}
            
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              
              {/* PDF Upload Upfront */}
              <div style={{ padding: 16, border: "2px dashed var(--border)", borderRadius: 16, background: "var(--bg-elevated)", textAlign: "center", position: "relative" }}>
                <input type="file" accept=".pdf" onChange={handlePdfSelect} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
                <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  {selectedFile ? selectedFile.name : (editBook && editBook.has_pdf ? "Update PDF File" : "Drag & Drop PDF or Click to Browse")}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  {selectedFile ? "File ready to upload" : "AI will automatically extract book details"}
                </div>
              </div>

              <div className="grid-2">
                <div className="input-group"><label>Title *</label><input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required /></div>
                <div className="input-group"><label>Author</label><input className="input" value={form.author} onChange={e => setForm({...form, author: e.target.value})} /></div>
              </div>
              <div className="input-group">
                <label>Description</label>
                <textarea className="textarea" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={4} />
              </div>
              <div className="grid-2">
                <div className="input-group"><label>Genre</label><input className="input" value={form.genre} onChange={e => setForm({...form, genre: e.target.value})} /></div>
                <div className="input-group"><label>Tags (comma-separated)</label><input className="input" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} placeholder="fiction, sci-fi" /></div>
              </div>
              <div className="flex gap-sm" style={{ justifyContent: "flex-end", marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || extracting}>
                  {saving ? "Saving & Uploading..." : (editBook ? "Update Book" : "Create Book")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
