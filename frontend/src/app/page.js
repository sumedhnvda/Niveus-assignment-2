"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, googleProvider, signInWithPopup } from "@/lib/firebase";
import api from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const user = api.getUser();
    if (user) {
      router.push(user.role === "admin" ? "/admin" : "/user");
    }
  }, [router]);

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      const data = await api.loginWithFirebase(idToken);
      router.push(data.role === "admin" ? "/admin" : "/user");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to sign in with Google.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Background decoration */}
      <div style={styles.bgDecor}>
        <div style={styles.circle1}></div>
        <div style={styles.circle2}></div>
        <div style={styles.circle3}></div>
      </div>

      {/* Floating shapes */}
      <div style={styles.floatGrid}>
        {mounted && [...Array(6)].map((_, i) => (
          <div key={i} style={{
            ...styles.floatDot,
            top: `${15 + Math.random() * 70}%`,
            left: `${10 + Math.random() * 80}%`,
            animationDelay: `${i * 0.5}s`,
            width: 6 + Math.random() * 8,
            height: 6 + Math.random() * 8,
          }}></div>
        ))}
      </div>

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoWrapper}>
          <div style={styles.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <path d="M8 7h8" /><path d="M8 11h6" />
            </svg>
          </div>
        </div>

        <h1 style={styles.title}>Niveus Library</h1>
        <p style={styles.subtitle}>AI-Powered Digital Library Platform</p>

        <div style={styles.divider}></div>

        <p style={styles.desc}>
          Sign in with your Google account to access our collection of books, AI-powered recommendations, and intelligent search.
        </p>

        {error && <div style={styles.error}>{error}</div>}

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={styles.googleBtn}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          {loading ? (
            <span className="loading-spinner" style={{ borderColor: "#ddd", borderTopColor: "#333", width: 18, height: 18 }}></span>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <div style={styles.features}>
          {[
            { icon: "📚", text: "Vast Library" },
            { icon: "🤖", text: "AI Assistant" },
            { icon: "🔍", text: "Smart Search" },
          ].map((f, i) => (
            <div key={i} style={styles.featureChip}>
              <span>{f.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", background: "linear-gradient(160deg, #f0fdf4 0%, #f8faf9 40%, #ecfdf5 100%)" },
  bgDecor: { position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" },
  circle1: { position: "absolute", top: "-20%", right: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.08), transparent 70%)" },
  circle2: { position: "absolute", bottom: "-15%", left: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.06), transparent 70%)" },
  circle3: { position: "absolute", top: "30%", left: "50%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,163,74,0.04), transparent 70%)" },
  floatGrid: { position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" },
  floatDot: { position: "absolute", borderRadius: "50%", background: "rgba(34,197,94,0.15)", animation: "float 4s ease-in-out infinite" },
  card: { position: "relative", zIndex: 1, background: "white", border: "1px solid var(--border)", borderRadius: 28, padding: "48px 44px", width: 440, boxShadow: "0 8px 40px rgba(0,0,0,0.06)", textAlign: "center" },
  logoWrapper: { display: "flex", justifyContent: "center", marginBottom: 20 },
  logoIcon: { width: 56, height: 56, borderRadius: 16, background: "var(--accent-gradient)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(34,197,94,0.3)" },
  title: { fontSize: 28, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "var(--text-muted)", fontWeight: 400 },
  divider: { height: 1, background: "var(--border)", margin: "24px 0" },
  desc: { fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 28 },
  error: { padding: "12px 16px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 12, color: "var(--danger)", fontSize: 13, marginBottom: 20, textAlign: "left" },
  googleBtn: { width: "100%", padding: "14px 24px", background: "white", border: "1.5px solid var(--border)", borderRadius: 14, fontSize: 15, fontWeight: 600, fontFamily: "inherit", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, transition: "all 0.2s ease", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  features: { display: "flex", justifyContent: "center", gap: 12, marginTop: 28 },
  featureChip: { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "var(--bg-elevated)", borderRadius: 100, border: "1px solid var(--border)" },
};
