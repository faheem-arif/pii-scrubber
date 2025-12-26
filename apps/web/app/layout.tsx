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
            <Link
              href="/"
              className="inline-flex h-9 items-center justify-center rounded-full bg-[var(--accent)] px-4 text-sm font-semibold leading-none text-ink shadow-soft hover:bg-[var(--accent-dark)] transition"
            >
              PII + Secret Scrubber
            </Link>
            <nav className="flex items-center gap-3 text-xs text-slate">
              <Link
                href="/how-it-works"
                className="inline-flex h-9 items-center justify-center rounded-full bg-[var(--accent)] px-4 text-center font-semibold leading-none text-ink shadow-soft hover:bg-[var(--accent-dark)] transition"
              >
                How it works
              </Link>
              <a
                href="https://github.com/faheem-arif/pii-scrubber"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center rounded-full bg-[var(--accent)] px-4 text-center font-semibold leading-none text-ink shadow-soft hover:bg-[var(--accent-dark)] transition"
              >
                GitHub
              </a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
