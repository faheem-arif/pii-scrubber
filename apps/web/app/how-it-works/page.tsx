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
            This tool runs entirely in your browser. No uploads, no telemetry, no analytics.
            Your data never leaves your device.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">Local-only scrubbing</h2>
            <p className="mt-3 text-sm text-slate">
              This tool runs entirely in your browser. No uploads, no telemetry, no analytics. Your data
              never leaves your device.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate">
              <li>Scrubbing runs inside a Web Worker to keep the UI responsive.</li>
              <li>Input stays in memory during processing.</li>
              <li>Data is cleared when you refresh or close the page.</li>
            </ul>
          </section>

          <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">Detection approach (deterministic)</h2>
            <p className="mt-3 text-sm text-slate">
              Detection uses regex, structural validation, and entropy checks. There are no AI or LLM calls.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate">
              <li>Default mode scrubs high-confidence matches.</li>
              <li>Aggressive mode expands matching at the cost of more false positives.</li>
            </ul>
          </section>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">Scrub modes</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate">
              <li>
                <span className="font-semibold text-ink">Redact:</span> irreversible placeholders
                (e.g., [EMAIL_REDACTED]).
              </li>
              <li>
                <span className="font-semibold text-ink">Token-map:</span> stable tokens
                (e.g., [[EMAIL:1]]) plus mapping.jsonl that can restore originals.
              </li>
              <li>
                <span className="font-semibold text-ink">Hash:</span> salted SHA-256 digests for
                consistent, non-reversible identifiers.
              </li>
            </ul>
          </section>

          <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">Outputs</h2>
            <p className="mt-3 text-sm text-slate">You can export:</p>
            <ul className="mt-2 space-y-2 text-sm text-slate">
              <li>Scrubbed output</li>
              <li>report.json summary (counts, offsets, types) without original values</li>
            </ul>
            <p className="mt-3 text-sm text-slate">
              Token-map warning: mapping.jsonl contains original sensitive values. Treat it like the
              unsanitized input and encrypt it before storing or sharing.
            </p>
          </section>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">Privacy checklist</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate">
              <li>Keep Aggressive off unless you need extra coverage.</li>
              <li>Use a private salt in Hash mode if you need consistent results over time.</li>
              <li>Encrypt mapping.jsonl before sharing or storing off-device.</li>
              <li>Avoid scrubbing on shared or untrusted devices.</li>
            </ul>
          </section>

          <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">Limitations</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate">
              <li>Regex and heuristics are not guaranteed to catch everything.</li>
              <li>Always review scrubbed output before sharing externally.</li>
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}
