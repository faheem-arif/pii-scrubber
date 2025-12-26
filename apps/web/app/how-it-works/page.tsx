export const metadata = {
  title: "How it works | PII + Secret Scrubber",
  description: "Learn how local-only scrubbing works and how your data stays private."
};

export default function HowItWorksPage() {
  return (
    <main className="relative z-10 px-6 py-10 md:px-12">
      <section className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-slate">How it works</p>
          <h1 className="mt-3 text-3xl md:text-4xl font-semibold text-ink">
            Local-only scrubbing, explained
          </h1>
          <p className="mt-3 text-sm text-slate max-w-2xl">
            The scrubber runs entirely in your browser. No uploads, no telemetry, and no analytics.
            Your data never leaves your device.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">Local-only by design</h2>
            <p className="mt-3 text-sm text-slate">
              All detection and replacements run inside a Web Worker in your browser. The app does not
              send any content to a server and does not make network calls with your data.
            </p>
            <p className="mt-3 text-sm text-slate">
              Your input stays in memory while you scrub and is cleared when you refresh or close the page.
            </p>
          </section>

          <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">Deterministic detection</h2>
            <p className="mt-3 text-sm text-slate">
              We use regex + structural validation + entropy checks. There are no AI models or LLM calls.
            </p>
            <p className="mt-3 text-sm text-slate">
              High-confidence matches are scrubbed by default. Aggressive mode expands matching at the
              cost of more false positives.
            </p>
          </section>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">Scrub modes</h2>
            <div className="mt-3 space-y-3 text-sm text-slate">
              <p>
                <span className="font-semibold text-ink">Redact:</span> irreversible replacement like
                [EMAIL_REDACTED].
              </p>
              <p>
                <span className="font-semibold text-ink">Token-map:</span> stable tokens like [[EMAIL:1]]
                plus a mapping.jsonl file that can restore originals.
              </p>
              <p>
                <span className="font-semibold text-ink">Hash:</span> salted SHA-256 digests for linkable,
                non-reversible identifiers.
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">Outputs and safety</h2>
            <p className="mt-3 text-sm text-slate">
              You can download the scrubbed text and a report.json summary. The report contains only
              metadata (counts, offsets, types) and never includes the original values.
            </p>
            <p className="mt-3 text-sm text-slate">
              If you use token-map, mapping.jsonl contains sensitive originals. Store it securely and
              encrypt before sharing.
            </p>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">Privacy checklist</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate">
            <li>Keep Aggressive off unless you need extra coverage.</li>
            <li>Use a private salt in Hash mode if you need consistent results over time.</li>
            <li>Encrypt mapping.jsonl before sharing or storing off-device.</li>
            <li>Avoid scrubbing on shared or untrusted devices.</li>
          </ul>
        </section>
      </section>
    </main>
  );
}
