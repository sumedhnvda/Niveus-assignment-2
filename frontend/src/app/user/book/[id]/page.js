"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import ReactMarkdown from "react-markdown";

export default function BookDetail() {
  const params = useParams();
  const router = useRouter();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPdf, setShowPdf] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  
  const [summary, setSummary] = useState(null);
  const [summarizing, setSummarizing] = useState(false);
  
  // Quiz
  const [quizResult, setQuizResult] = useState(null);
  const [quizzing, setQuizzing] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showQuizResults, setShowQuizResults] = useState(false);



  useEffect(() => { 
    loadBook();

  }, [params.id]);

  useEffect(() => {
    return () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); };
  }, [pdfBlobUrl]);

  const loadBook = async () => {
    try {
      const b = await api.getBook(params.id);
      setBook(b);
      if (b.cached_summary) setSummary(b.cached_summary);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    try {
      const result = await api.summarizeBook(params.id);
      setSummary(result.response);
    } catch (e) { alert(e.message); }
    finally { setSummarizing(false); }
  };

  const handleQuiz = async () => {
    setQuizzing(true);
    try {
      const result = await api.quizBook(params.id);
      let parsed;
      try {
        let cleanStr = result.response.replace(/```json/g, "").replace(/```/g, "").trim();
        parsed = JSON.parse(cleanStr);
      } catch (e) {
        const match = result.response.match(/\[[\s\S]*\]/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error("Invalid format from AI");
      }
      setQuizResult(parsed);
      setCurrentQuestionIndex(0);
      setSelectedAnswers({});
      setShowQuizResults(false);
    } catch (e) { alert("Failed to generate quiz. Try again."); }
    finally { setQuizzing(false); }
  };

  const handleReadPdf = async () => {
    if (pdfBlobUrl) { setShowPdf(true); return; }
    setLoadingPdf(true);
    try {
      const blob = await api.getBookPdfBlob(params.id);
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      setShowPdf(true);
    } catch (e) { alert("Failed to load PDF: " + e.message); } 
    finally { setLoadingPdf(false); }
  };






  if (loading) return <div className="flex flex-center" style={{ minHeight: "60vh" }}><div className="loading-spinner" style={{ width: 32, height: 32 }}></div></div>;
  if (!book) return <div className="empty-state"><h3>Book not found</h3></div>;

  return (
    <div>
      {!showPdf && (
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()} style={{ marginBottom: 24, paddingLeft: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back to Library
        </button>
      )}

      {!showPdf ? (
        <div>
          <div className="card" style={{ display: "flex", gap: 36, padding: 36 }}>
            <div style={{
              width: 220, height: 310, background: "linear-gradient(135deg, #16a34a, #22c55e)",
              borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 72, flexShrink: 0, boxShadow: "0 12px 32px rgba(34,197,94,0.3)"
            }}>
              📖
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>{book.title}</h1>
              <p style={{ fontSize: 18, color: "var(--text-secondary)", marginBottom: 16, fontWeight: 500 }}>by {book.author}</p>

              <div className="flex gap-sm" style={{ marginBottom: 24, flexWrap: "wrap" }}>
                {book.genre && <span className="badge badge-info">{book.genre}</span>}
                {book.tags?.map(t => <span key={t} className="badge badge-primary">{t}</span>)}
                {book.page_count > 0 && <span className="badge badge-success">{book.page_count} pages</span>}
              </div>

              {book.description && (
                <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: 28, flex: 1 }}>{book.description}</p>
              )}

              <div className="flex gap-sm" style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "rgba(59,130,246,0.1)", borderRadius: 10, color: "#2563eb", border: "1px solid rgba(59,130,246,0.2)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{book.total_views} views</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "rgba(34,197,94,0.1)", borderRadius: 10, color: "#16a34a", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{book.total_reads} reads</span>
                </div>
              </div>

              <div className="flex gap-md">
                {book.has_pdf && (
                  <button className="btn btn-primary" onClick={handleReadPdf} disabled={loadingPdf} style={{ padding: "12px 24px" }}>
                    {loadingPdf ? <span className="loading-spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}></span> : "📄 Read Book"}
                  </button>
                )}
                {!summary && (
                  <button className="btn btn-secondary" onClick={handleSummarize} disabled={summarizing} style={{ padding: "12px 24px" }}>
                    {summarizing ? <><span className="loading-spinner"></span> Generating...</> : "📝 Generate Summary"}
                  </button>
                )}
                <button className="btn btn-secondary" onClick={handleQuiz} disabled={quizzing} style={{ padding: "12px 24px", borderColor: "var(--accent-primary)", color: "var(--accent-primary)" }}>
                  {quizzing ? <><span className="loading-spinner" style={{ borderColor: 'rgba(34,197,94,0.3)', borderTopColor: 'var(--accent-primary)' }}></span> Preparing Quiz...</> : "🎯 Quiz Me"}
                </button>
              </div>
            </div>
          </div>

          {/* Quiz Result */}
          {quizResult && Array.isArray(quizResult) && (
            <div className="card" style={{ marginTop: 24, background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <div className="flex flex-between" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 10, color: "var(--accent-primary)" }}>
                  <span style={{ background: "white", padding: 8, borderRadius: 10, boxShadow: "var(--shadow-sm)" }}>🎯</span>
                  Live Assignment
                </h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setQuizResult(null)}>Close</button>
              </div>

              {!showQuizResults ? (
                <div>
                  <div style={{ marginBottom: 20, display: "flex", gap: 6 }}>
                    {quizResult.map((_, i) => (
                      <div key={i} style={{ height: 6, flex: 1, borderRadius: 3, background: i <= currentQuestionIndex ? "var(--accent-primary)" : "var(--bg-elevated)" }} />
                    ))}
                  </div>
                  
                  <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>
                    {currentQuestionIndex + 1}. {quizResult[currentQuestionIndex].question}
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {quizResult[currentQuestionIndex].options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedAnswers(prev => ({...prev, [currentQuestionIndex]: i}))}
                        style={{
                          textAlign: "left", padding: "12px 16px", borderRadius: 12,
                          background: selectedAnswers[currentQuestionIndex] === i ? "var(--accent-primary)" : "white",
                          color: selectedAnswers[currentQuestionIndex] === i ? "white" : "var(--text-primary)",
                          border: `1px solid ${selectedAnswers[currentQuestionIndex] === i ? "var(--accent-primary)" : "var(--border)"}`,
                          cursor: "pointer", transition: "all 0.2s"
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
                    <button 
                      className="btn btn-primary"
                      disabled={selectedAnswers[currentQuestionIndex] === undefined}
                      onClick={() => {
                        if (currentQuestionIndex < quizResult.length - 1) {
                          setCurrentQuestionIndex(prev => prev + 1);
                        } else {
                          setShowQuizResults(true);
                        }
                      }}
                    >
                      {currentQuestionIndex < quizResult.length - 1 ? "Next Question" : "Submit Quiz"}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ textAlign: "center", marginBottom: 30 }}>
                    <div style={{ fontSize: 48, marginBottom: 10 }}>
                      {Object.keys(selectedAnswers).filter(k => selectedAnswers[k] === quizResult[k].answer).length} / {quizResult.length}
                    </div>
                    <h4 style={{ fontSize: 20, color: "var(--text-primary)" }}>Quiz Completed!</h4>
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    {quizResult.map((q, i) => {
                      const isCorrect = selectedAnswers[i] === q.answer;
                      return (
                        <div key={i} style={{ padding: 16, background: "white", borderRadius: 12, border: `1px solid ${isCorrect ? "#22c55e" : "#ef4444"}` }}>
                          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{i+1}. {q.question}</div>
                          <div style={{ fontSize: 14, color: isCorrect ? "#16a34a" : "#dc2626", fontWeight: 500, marginBottom: 8 }}>
                            {isCorrect ? "✅ Correct" : `❌ Incorrect (You chose: ${q.options[selectedAnswers[i]]})`}
                          </div>
                          <div style={{ fontSize: 14, color: "var(--text-secondary)", background: "var(--bg-surface)", padding: 12, borderRadius: 8 }}>
                            <strong>Correct Answer:</strong> {q.options[q.answer]}<br/><br/>
                            <em>{q.explanation}</em>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
                    <button className="btn btn-primary" onClick={() => { setQuizResult(null); }}>Done</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div className="card" style={{ marginTop: 24, background: "var(--bg-elevated)", border: "none" }}>
              <div className="flex flex-between" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: "white", padding: 8, borderRadius: 10, boxShadow: "var(--shadow-sm)" }}>✨</span>
                  AI Summary
                </h3>
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-primary)" }}>
                <ReactMarkdown components={{ p: ({node, ...props}) => <p style={{ marginBottom: 12 }} {...props} />, ul: ({node, ...props}) => <ul style={{ marginBottom: 12, paddingLeft: 24 }} {...props} /> }}>
                  {summary}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, background: "var(--bg-default)", display: "flex", flexDirection: "column" }}>
          
          {/* Reader Top Bar */}
          <div style={{ 
            background: "white", padding: "12px 24px", borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10,
            boxShadow: "var(--shadow-sm)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button className="btn btn-ghost" onClick={() => setShowPdf(false)} style={{ padding: 8, borderRadius: "50%", background: "var(--bg-elevated)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{book.title}</h2>
                <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>{book.author}</div>
              </div>
            </div>
          </div>

          {/* PDF Viewer */}
          <div style={{ flex: 1, position: "relative", background: "#f0f2f5" }}>
            {pdfBlobUrl ? (
              <iframe
                src={`${pdfBlobUrl}#view=FitH`}
                style={{ width: "100%", height: "100%", border: "none" }}
                title={book.title}
              />
            ) : (
              <div className="flex flex-center" style={{ height: "100%" }}><span className="loading-spinner"></span></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
