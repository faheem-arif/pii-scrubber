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
            <p className="uppercase tracking-[0.3em] text-xs text-slate">Local-First Scrubber</p>
            <h1 className="text-4xl md:text-5xl font-semibold text-ink">
              PII + Secret Scrubber for Offline Logs
            </h1>
            <p className="text-slate max-w-2xl">
              Paste text or drop a file. Everything scrubs locally in your browser with
              deterministic rules and zero uploads.
            </p>
          </header>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section
              className="bg-[var(--panel)] border border-[var(--panel-border)] rounded-3xl p-6 shadow-soft animate-rise"
              onDrop={onDrop}
              onDragOver={(event) => event.preventDefault()}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Input</h2>
                  <p className="text-sm text-slate">
                    Drag a .txt/.log/.json file here or paste directly.
                  </p>
                </div>
                <label className="text-sm font-semibold text-ink">
                  <span className="px-3 py-2 border border-dashed border-slate rounded-full cursor-pointer hover:border-ink transition">
                    Browse
                  </span>
                  <input
                    type="file"
                    accept=".txt,.log,.json"
                    className="hidden"
                    onChange={onBrowse}
                  />
                </label>
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
              <h2 className="text-xl font-semibold">Scrub Options</h2>
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
                  <label className="text-sm font-semibold text-slate">
                    Hash salt (never persisted)
                    <input
                      type="text"
                      value={hashSalt}
                      onChange={(event) => setHashSalt(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[var(--panel-border)] bg-white p-2 text-sm"
                      placeholder="Enter a salt..."
                    />
                  </label>
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
                    className="rounded-full border border-[var(--panel-border)] px-5 py-2 text-sm font-semibold text-slate hover:border-ink transition"
                  >
                    Clear
                  </button>
                </div>

                {message ? (
                  <p className="text-sm text-rose-700">{message}</p>
                ) : null}

                <div className="mt-4 rounded-2xl border border-[var(--panel-border)] bg-[#fbfaf7] p-4 text-xs text-slate">
                  <p className="text-sm font-semibold text-ink">Mode guide</p>
                  <p className="mt-2">
                    Redact replaces matches with [TYPE_REDACTED] and is irreversible.
                  </p>
                  <p className="mt-2">
                    Token-map swaps matches for stable tokens like [[EMAIL:1]] and writes a mapping file
                    you must protect.
                  </p>
                  <p className="mt-2">
                    Hash uses your salt to create TYPE_SHA256 digests; same input + salt gives the same output.
                  </p>
                  <p className="mt-3">
                    Privacy: all work stays in your browser via a Web Worker. No uploads, no telemetry.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="bg-[var(--panel)] border border-[var(--panel-border)] rounded-3xl p-6 shadow-soft">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Output</h2>
                  <p className="text-sm text-slate">Review and export scrubbed results.</p>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate">
                  <input
                    type="checkbox"
                    checked={diffView}
                    onChange={(event) => setDiffView(event.target.checked)}
                  />
                  Diff view
                </label>
              </div>

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
                  className="rounded-full border border-[var(--panel-border)] px-4 py-2 text-xs font-semibold text-slate hover:border-ink transition"
                  disabled={!outputText}
                >
                  Download scrubbed
                </button>
                <button
                  type="button"
                  onClick={downloadReport}
                  className="rounded-full border border-[var(--panel-border)] px-4 py-2 text-xs font-semibold text-slate hover:border-ink transition"
                  disabled={!report}
                >
                  Download report.json
                </button>
                {mode === "token-map" ? (
                  <button
                    type="button"
                    onClick={downloadMapping}
                    className="rounded-full border border-[var(--panel-border)] px-4 py-2 text-xs font-semibold text-slate hover:border-ink transition"
                    disabled={!mappingJsonl}
                  >
                    Download mapping.jsonl
                  </button>
                ) : null}
              </div>

              {mode === "token-map" && mappingJsonl ? (
                <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  mapping.jsonl contains sensitive data. Store it securely and encrypt before sharing.
                </div>
              ) : null}
            </div>

            <aside className="bg-[var(--panel)] border border-[var(--panel-border)] rounded-3xl p-6 shadow-soft">
              <h2 className="text-xl font-semibold">Summary</h2>
              <p className="text-sm text-slate">Counts by detected type.</p>

              <div className="mt-4 flex flex-wrap gap-2">
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

              <div className="mt-6 space-y-3 text-xs text-slate">
                <p>
                  Everything runs locally in your browser. No uploads. No telemetry.
                </p>
                <p>
                  Hash mode requires a salt each run and never stores it.
                </p>
                <p>
                  Token-map mode is reversible only with the mapping file.
                </p>
              </div>
            </aside>
          </section>
        </div>
      </section>
    </main>
  );
}
