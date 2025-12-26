import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Local-First PII + Secret Scrubber",
  description: "Scrub sensitive data entirely in your browser."
};

const isDev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'"
].join("; ");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content={csp}
        />
        <meta httpEquiv="Referrer-Policy" content="no-referrer" />
      </head>
      <body className="relative">
        <header className="relative z-20 px-6 pt-6 md:px-12">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link href="/" className="text-sm font-semibold text-ink">
              PII + Secret Scrubber
            </Link>
            <nav className="flex items-center gap-3 text-xs text-slate">
              <Link
                href="/how-it-works"
                className="rounded-full bg-[var(--accent)] px-4 py-2 font-semibold text-ink shadow-soft hover:bg-[var(--accent-dark)] transition"
              >
                How it works
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
