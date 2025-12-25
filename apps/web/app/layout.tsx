import "./globals.css";

export const metadata = {
  title: "Local-First PII + Secret Scrubber",
  description: "Scrub sensitive data entirely in your browser."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="relative">
        {children}
      </body>
    </html>
  );
}
