import "./globals.css";

export const metadata = {
  title: "Niveus Solutions — AI-Powered Book Management",
  description: "Digital library platform with multi-agent AI for book recommendations, content Q&A, and intelligent reading",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
