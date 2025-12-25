import "./globals.css";

export const metadata = {
  title: "Local-First PII + Secret Scrubber",
  description: "Scrub sensitive data entirely in your browser."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
        />
        <meta httpEquiv="Referrer-Policy" content="no-referrer" />
      </head>
      <body className="relative">
        {children}
      </body>
    </html>
  );
}
