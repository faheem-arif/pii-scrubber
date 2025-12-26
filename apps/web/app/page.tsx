"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ScrubMode, ScrubOptions, ScrubReport } from "@pii-scrubber/core";
import { buildLineDiff } from "../src/utils/diff";
import { downloadFile } from "../src/utils/download";

const MAX_FILE_MB = 25;
const WARN_FILE_MB = 5;
const DIFF_LIMIT = 2000;

const formatBytes = (bytes: number) =>
  `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

const EXAMPLE_TEXT = `User john.doe@corp.com logged in from 192.168.1.10.
JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
AWS key: AKIAIOSFODNN7EXAMPLE
Secret token=sk_live_51H8XyZp2Qd3MNx6y7a8b9c0d1e2f3g4`;

const secondaryButtonClass =
  "rounded-full border border-[var(--panel-border)] bg-[#fbfaf7] px-4 py-2 text-xs font-semibold text-slate shadow-soft hover:border-ink hover:text-ink transition";
const smallPillClass =
  "inline-flex items-center justify-center rounded-full border border-[var(--panel-border)] bg-[#fbfaf7] px-3 py-2 text-[11px] font-semibold text-slate shadow-soft hover:border-ink hover:text-ink transition";
const smallPillAccentClass =
  "inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-3 py-2 text-[11px] font-semibold text-ink shadow-soft hover:bg-[var(--accent-dark)] transition";

const modeDescriptions: Record<ScrubMode, string> = {
  redact: "Irreversible replacement like [EMAIL_REDACTED]. Best for sharing.",
  "token-map": "Stable tokens plus a mapping file that can restore originals.",
  hash: "Salted SHA-256 digests for linkable, non-reversible IDs."
};

export default function HomePage() {
  const workerRef = useRef<Worker | null>(null);
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [report, setReport] = useState<ScrubReport | null>(null);
  const [mappingJsonl, setMappingJsonl] = useState<string | null>(null);
  const [mode, setMode] = useState<ScrubMode>("redact");
  const [keepLast, setKeepLast] = useState(0);
  const [aggressive, setAggressive] = useState(false);
  const [hashSalt, setHashSalt] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [diffView, setDiffView] = useState(false);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const generateSalt = () => {
    setMessage(null);
    if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
      setMessage("Random salt not supported in this browser.");
      return;
    }
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    setHashSalt(hex);
  };

  useEffect(() => {
    const worker = new Worker(
      new URL("../src/workers/scrubWorker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as
        | { ok: true; result: { scrubbedText: string; report: ScrubReport; mappingJsonl?: string } }
        | { ok: false; error: string };
      if (data.ok) {
        setOutputText(data.result.scrubbedText);
        setReport(data.result.report);
        setMappingJsonl(data.result.mappingJsonl ?? null);
        const count = data.result.report.totalFindings;
        setToastMessage(`${count} finding${count === 1 ? "" : "s"} scrubbed`);
      } else {
        setMessage(data.error);
      }
      setBusy(false);
    };

    worker.onerror = () => {
      setMessage("Worker error: please refresh the page.");
      setBusy(false);
    };

    return () => {
      worker.terminate();
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }
    const timer = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const diffRows = useMemo(() => {
    if (!diffView) {
      return [];
    }
    return buildLineDiff(inputText, outputText, DIFF_LIMIT);
  }, [diffView, inputText, outputText]);

  const handleFile = (file: File) => {
    setMessage(null);
    setWarning(null);
    setFileLabel(`${file.name} (${formatBytes(file.size)})`);

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setMessage(`File too large. ${MAX_FILE_MB} MB max in v1.`);
      return;
    }

    if (file.size > WARN_FILE_MB * 1024 * 1024) {
      setWarning(`Large file: ${formatBytes(file.size)}. Scrub may be slower.`);
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setInputText(content);
    };
    reader.onerror = () => {
      setMessage("Failed to read file.");
    };
    reader.readAsText(file);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const onBrowse = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const runScrub = () => {
    setMessage(null);
    if (!workerRef.current) {
      setMessage("Worker not ready.");
      return;
    }
    if (!inputText.trim()) {
      setMessage("Add some text or drop a file to scrub.");
      return;
    }
    if (mode === "hash" && !hashSalt.trim()) {
      setMessage("Hash mode requires a salt.");
      return;
    }
    const options: ScrubOptions = {
      mode,
      keepLast,
      aggressive,
      ...(mode === "hash" ? { hashSalt } : {})
    };
    setBusy(true);
    workerRef.current.postMessage({ text: inputText, options });
  };

  const resetAll = () => {
    setInputText("");
    setOutputText("");
    setReport(null);
    setMappingJsonl(null);
    setMessage(null);
    setWarning(null);
    setFileLabel(null);
  };

  const loadExample = () => {
    setMessage(null);
    setWarning(null);
    setFileLabel("Example data");
    setInputText(EXAMPLE_TEXT);
    setOutputText("");
    setReport(null);
    setMappingJsonl(null);
  };

  const copyOutput = async () => {
    if (!outputText) {
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setMessage("Clipboard not available in this browser.");
      return;
    }
    try {
      await navigator.clipboard.writeText(outputText);
      setToastMessage("Output copied");
    } catch {
      setMessage("Failed to copy output.");
    }
  };

  const downloadReport = () => {
    if (!report) {
      return;
    }
    downloadFile("report.json", JSON.stringify(report, null, 2), "application/json");
  };

  const downloadOutput = () => {
    if (!outputText) {
      return;
    }
    downloadFile("scrubbed.txt", outputText, "text/plain;charset=utf-8");
  };

  const downloadMapping = () => {
    if (!mappingJsonl) {
      return;
    }
    downloadFile("mapping.jsonl", mappingJsonl, "application/jsonl");
  };

  const typeBadges = report ? Object.entries(report.byType) : [];
  const typeList = typeBadges.length
    ? typeBadges.sort((a, b) => b[1] - a[1])
    : [];

  return (
    <main className="relative z-10 px-6 py-10 md:px-12">
      <section className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-3 animate-rise">
            <p className="uppercase tracking-[0.3em] text-xs text-slate">
              Local-only — nothing leaves your browser
            </p>
            <h1 className="text-4xl md:text-5xl font-semibold text-ink">
              PII + Secret Scrubber
            </h1>
            <p className="text-slate max-w-none">
              Paste text or drop a file. Scrubbing runs locally in your browser with
              deterministic rules and no uploads.
            </p>
          </header>

          <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-xs text-slate shadow-soft animate-rise">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink">How to use</h2>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-[#fbfaf7] p-4">
                <p className="text-ink font-semibold">1. Input</p>
                <p className="mt-1">Paste text or drop/upload the file.</p>
              </div>
              <div className="rounded-2xl bg-[#fbfaf7] p-4">
                <p className="text-ink font-semibold">2. Choose scrub mode</p>
                <p className="mt-1">Pick redact, token-map, or salted hash.</p>
              </div>
              <div className="rounded-2xl bg-[#fbfaf7] p-4">
                <p className="text-ink font-semibold">3. Scrub + download</p>
                <p className="mt-1">Review output, then export the results.</p>
              </div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section
              className="bg-[var(--panel)] border border-[var(--panel-border)] rounded-3xl p-6 shadow-soft animate-rise"
              onDrop={onDrop}
              onDragOver={(event) => event.preventDefault()}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">1. Input</h2>
                  <p className="text-sm text-slate">
                    Drag a .txt/.log/.json file here or paste directly.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={loadExample}
                    className={smallPillClass}
                  >
                    Use example
                  </button>
                  <label className={smallPillAccentClass}>
                    Browse
                    <input
                      type="file"
                      accept=".txt,.log,.json"
                      className="hidden"
                      onChange={onBrowse}
                    />
                  </label>
                </div>
              </div>

              <textarea
                className="mt-4 w-full min-h-[260px] rounded-2xl border border-[var(--panel-border)] bg-[#fbfaf7] p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="Paste logs, JSON, or text here..."
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
              />

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate">
                <span className="px-3 py-1 rounded-full border border-[var(--panel-border)]">
                  {inputText.length.toLocaleString()} chars
                </span>
                {fileLabel ? (
                  <span className="px-3 py-1 rounded-full border border-[var(--panel-border)]">
                    {fileLabel}
                  </span>
                ) : null}
                {warning ? (
                  <span className="px-3 py-1 rounded-full border border-[var(--panel-border)] text-amber-700">
                    {warning}
                  </span>
                ) : null}
              </div>
            </section>

            <section className="bg-[var(--panel)] border border-[var(--panel-border)] rounded-3xl p-6 shadow-soft animate-rise">
              <h2 className="text-xl font-semibold">2. Scrub Options</h2>
              <div className="mt-4 grid gap-4">
                <label className="text-sm font-semibold text-slate">
                  Mode
                  <select
                    className="mt-2 w-full rounded-2xl border border-[var(--panel-border)] bg-white p-2 text-sm"
                    value={mode}
                    onChange={(event) => setMode(event.target.value as ScrubMode)}
                  >
                    <option value="redact">Redact</option>
                    <option value="token-map">Token map</option>
                    <option value="hash">Hash (salted)</option>
                  </select>
                  <p className="mt-2 text-xs font-normal text-slate">
                    {modeDescriptions[mode]}
                  </p>
                </label>

                <label className="text-sm font-semibold text-slate">
                  Keep last N characters
                  <input
                    type="number"
                    min={0}
                    max={64}
                    value={keepLast}
                    onChange={(event) => setKeepLast(Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-[var(--panel-border)] bg-white p-2 text-sm"
                  />
                  <p className="mt-2 text-xs font-normal text-slate">
                    Example: set 4 to keep the last 4 characters visible after scrubbing.
                  </p>
                </label>

                <label className="flex items-center gap-3 text-sm font-semibold text-slate">
                  <input
                    type="checkbox"
                    checked={aggressive}
                    onChange={(event) => setAggressive(event.target.checked)}
                  />
                  Aggressive detection (more matches, more false positives)
                </label>

                {mode === "hash" ? (
                  <div className="text-sm font-semibold text-slate">
                    <label className="text-sm font-semibold text-slate">
                      Hash salt (never persisted)
                      <input
                        type="text"
                        value={hashSalt}
                        onChange={(event) => setHashSalt(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[var(--panel-border)] bg-white p-2 text-sm"
                        placeholder="Enter a private salt..."
                      />
                    </label>
                    <p className="mt-2 text-xs font-normal text-slate">
                      Use a private phrase you can reuse for consistent hashing. For a one-off scrub,
                      generate a random salt.
                    </p>
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={generateSalt}
                        className="rounded-full border border-[var(--panel-border)] bg-[#fbfaf7] px-4 py-1 text-[11px] font-semibold text-slate shadow-soft hover:border-ink hover:text-ink transition"
                      >
                        Generate random salt
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={runScrub}
                    className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-ink hover:bg-[var(--accent-dark)] transition"
                    disabled={busy}
                  >
                    {busy ? "Scrubbing..." : "Scrub"}
                  </button>
                  <button
                    type="button"
                    onClick={resetAll}
                    className="rounded-full border border-[var(--panel-border)] bg-[#fbfaf7] px-5 py-2 text-sm font-semibold text-slate shadow-soft hover:border-ink hover:text-ink transition"
                  >
                    Clear
                  </button>
                </div>

                {message ? (
                  <p className="text-sm text-rose-700">{message}</p>
                ) : null}

              </div>
            </section>
          </div>

          <section>
            <div className="bg-[var(--panel)] border border-[var(--panel-border)] rounded-3xl p-6 shadow-soft">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">3. Output</h2>
                  <p className="text-sm text-slate">Review and export scrubbed results.</p>
                </div>
                <label className="inline-flex items-center gap-2 rounded-full border border-[var(--panel-border)] bg-[#fbfaf7] px-3 py-1 text-[11px] font-semibold text-slate shadow-soft whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={diffView}
                    onChange={(event) => setDiffView(event.target.checked)}
                  />
                  Diff view
                </label>
              </div>

              {mode === "token-map" ? (
                <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                  Token-map creates a mapping.jsonl file with the original values. Download and store it
                  securely if you need to restore data later.
                </div>
              ) : null}

              {!diffView ? (
                <textarea
                  className="mt-4 w-full min-h-[260px] rounded-2xl border border-[var(--panel-border)] bg-[#fbfaf7] p-4 text-sm focus:outline-none"
                  value={outputText}
                  readOnly
                  placeholder="Scrubbed output appears here..."
                />
              ) : (
                <div className="mt-4 max-h-[360px] overflow-auto rounded-2xl border border-[var(--panel-border)] bg-[#fbfaf7]">
                  <div className="grid grid-cols-[60px_1fr_1fr] gap-px bg-[var(--panel-border)] text-xs">
                    <div className="bg-[#f5f0e6] px-3 py-2 font-semibold text-slate">Line</div>
                    <div className="bg-[#f5f0e6] px-3 py-2 font-semibold text-slate">Original</div>
                    <div className="bg-[#f5f0e6] px-3 py-2 font-semibold text-slate">Scrubbed</div>
                    {diffRows.map((row) => (
                      <div key={`line-${row.line}`} className="contents">
                        <div className="bg-white px-3 py-2 text-slate">{row.line}</div>
                        <div
                          className={`px-3 py-2 whitespace-pre-wrap ${
                            row.changed ? "bg-amber-50" : "bg-white"
                          }`}
                        >
                          {row.left}
                        </div>
                        <div
                          className={`px-3 py-2 whitespace-pre-wrap ${
                            row.changed ? "bg-emerald-50" : "bg-white"
                          }`}
                        >
                          {row.right}
                        </div>
                      </div>
                    ))}
                  </div>
                  {diffRows.length >= DIFF_LIMIT ? (
                    <div className="px-3 py-2 text-xs text-slate">
                      Diff limited to first {DIFF_LIMIT} lines.
                    </div>
                  ) : null}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={downloadOutput}
                  className={secondaryButtonClass}
                  disabled={!outputText}
                >
                  Download scrubbed
                </button>
                <button
                  type="button"
                  onClick={copyOutput}
                  className={secondaryButtonClass}
                  disabled={!outputText}
                >
                  Copy output
                </button>
                <button
                  type="button"
                  onClick={downloadReport}
                  className={secondaryButtonClass}
                  disabled={!report}
                >
                  Download report.json
                </button>
                {mode === "token-map" ? (
                  <button
                    type="button"
                    onClick={downloadMapping}
                    className={secondaryButtonClass}
                    disabled={!mappingJsonl}
                  >
                    Download mapping.jsonl
                  </button>
                ) : null}
              </div>

              <div className="mt-4 rounded-2xl border border-[var(--panel-border)] bg-[#fbfaf7] p-3">
                <p className="text-xs font-semibold text-ink">Summary</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate">
                  <span className="rounded-full border border-[var(--panel-border)] px-3 py-1 text-xs text-slate">
                    Total: {report?.totalFindings ?? 0}
                  </span>
                  {typeList.map(([type, count]) => (
                    <span
                      key={type}
                      className="rounded-full border border-[var(--panel-border)] px-3 py-1 text-xs text-slate"
                    >
                      {type}: {count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-fog shadow-soft">
          {toastMessage}
        </div>
      ) : null}
    </main>
  );
}
