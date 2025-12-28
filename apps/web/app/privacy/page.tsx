export const metadata = {
  title: "Privacy | PII + Secret Scrubber",
  description: "Privacy notice for the local-only PII + Secret Scrubber."
};

export default function PrivacyPage() {
  return (
    <main className="relative z-10 px-6 py-10 md:px-12">
      <section className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-slate">Privacy</p>
          <h1 className="mt-3 text-3xl md:text-4xl font-semibold text-ink">
            Privacy notice
          </h1>
          <p className="mt-3 text-sm text-slate max-w-2xl">
            This app is designed to run locally in your browser. We do not collect
            or store the text you scrub.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">Local-only processing</h2>
            <p className="mt-3 text-sm text-slate">
              Scrubbing runs in a Web Worker in your browser. Your input stays in memory
              while processing and is cleared when you refresh or close the page.
            </p>
          </section>

          <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">What we do not collect</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate">
              <li>No uploads of your text or files.</li>
              <li>No analytics, tracking pixels, or telemetry.</li>
            </ul>
            <p className="mt-3 text-sm text-slate">
              This app does not set cookies. Hosting or DNS providers may set their own cookies
              for security or operational purposes.
            </p>
          </section>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">Hosting and logs</h2>
            <p className="mt-3 text-sm text-slate">
              The site is hosted on GitHub Pages. GitHub may collect standard access logs
              (such as IP address, user agent, and request metadata) as part of hosting.
            </p>
            <p className="mt-3 text-sm text-slate">
              Your scrubbed content is never sent to GitHub Pages because the app does not upload
              your input.
            </p>
          </section>

          <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">Domain and DNS</h2>
            <p className="mt-3 text-sm text-slate">
              The domain is managed through Cloudflare. DNS providers may log queries as part
              of normal operations.
            </p>
            <p className="mt-3 text-sm text-slate">
              Cloudflare does not receive the text you scrub because it is never uploaded.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
