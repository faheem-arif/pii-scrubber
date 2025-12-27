import type { Finding, ScrubOptions, ScrubReport, ScrubResult } from "./types";
import { detectAll, type CandidateFinding } from "./detectors";
import { clampNumber } from "./utils";
import { sha256Hex } from "./hash";

const DEFAULT_MAX_MATCHES = 5000;
const MAX_MATCHES_HARD_CAP = 1000000;

const computeMaxMatches = (textLength: number, provided?: number): number => {
  const sizeBased = Math.ceil(textLength / 20);
  const requested = provided ?? Math.max(DEFAULT_MAX_MATCHES, sizeBased);
  return clampNumber(requested, 1, MAX_MATCHES_HARD_CAP);
};

const overlap = (a: CandidateFinding, b: CandidateFinding): boolean =>
  a.start < b.end && a.end > b.start;

const compareCandidates = (a: CandidateFinding, b: CandidateFinding): number => {
  const severityDiff = b.severity - a.severity;
  if (severityDiff !== 0) {
    return severityDiff;
  }
  const lengthDiff = (b.end - b.start) - (a.end - a.start);
  if (lengthDiff !== 0) {
    return lengthDiff;
  }
  return a.start - b.start;
};

const resolveOverlaps = (candidates: CandidateFinding[]): CandidateFinding[] => {
  const ordered = [...candidates].sort(compareCandidates);
  const selected: CandidateFinding[] = [];
  for (const candidate of ordered) {
    if (!selected.some((existing) => overlap(candidate, existing))) {
      selected.push(candidate);
    }
  }
  return selected.sort((a, b) => a.start - b.start);
};

const applyKeepLast = (replacement: string, original: string, keepLast: number): string => {
  if (keepLast <= 0) {
    return replacement;
  }
  const suffix = original.slice(-keepLast);
  return `${replacement}:${suffix}`;
};

const buildReplacement = (
  type: string,
  original: string,
  options: Required<Pick<ScrubOptions, "mode" | "keepLast" | "hashSalt">>,
  state: {
    tokenCounters: Map<string, number>;
    tokenLookup: Map<string, string>;
    mappingLines: string[];
    nowIso: string;
  }
): string => {
  const upperType = type.toUpperCase();
  if (options.mode === "redact") {
    const replacement = `[${upperType}_REDACTED]`;
    return applyKeepLast(replacement, original, options.keepLast);
  }

  if (options.mode === "hash") {
    const digest = sha256Hex(`${options.hashSalt}:${original}`);
    const replacement = `${upperType}_SHA256:${digest}`;
    return applyKeepLast(replacement, original, options.keepLast);
  }

  const key = `${type}::${original}`;
  let token = state.tokenLookup.get(key);
  if (!token) {
    const next = (state.tokenCounters.get(type) ?? 0) + 1;
    state.tokenCounters.set(type, next);
    token = `${upperType}:${next}`;
    state.tokenLookup.set(key, token);
    const mapping = {
      token,
      type,
      original,
      sha256: sha256Hex(original),
      firstSeen: state.nowIso
    };
    state.mappingLines.push(JSON.stringify(mapping));
  }
  const replacement = `[[${token}]]`;
  return applyKeepLast(replacement, original, options.keepLast);
};

export const scrubText = (text: string, options: ScrubOptions): ScrubResult => {
  const keepLast = clampNumber(options.keepLast ?? 0, 0, 64);
  const aggressive = options.aggressive ?? false;
  const maxMatches = computeMaxMatches(text.length, options.maxMatches);
  if (options.mode === "hash" && !options.hashSalt) {
    throw new Error("hash mode requires hashSalt");
  }

  const { candidates, hitLimit } = detectAll(text, { ...options, aggressive, maxMatches });
  const filtered = candidates.filter((finding) =>
    aggressive ? finding.confidence !== "low" : finding.confidence === "high"
  );
  const resolved = resolveOverlaps(filtered);

  const state = {
    tokenCounters: new Map<string, number>(),
    tokenLookup: new Map<string, string>(),
    mappingLines: [] as string[],
    nowIso: new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
  };

  const findings: Finding[] = resolved.map((finding) => {
    const original = text.slice(finding.start, finding.end);
    const replacement = buildReplacement(finding.type, original, {
      mode: options.mode,
      keepLast,
      hashSalt: options.hashSalt ?? ""
    }, state);
    return { ...finding, replacement };
  });

  let scrubbedText = text;
  for (let i = findings.length - 1; i >= 0; i--) {
    const finding = findings[i];
    scrubbedText =
      scrubbedText.slice(0, finding.start) +
      finding.replacement +
      scrubbedText.slice(finding.end);
  }

  const byType: Record<string, number> = {};
  for (const finding of findings) {
    byType[finding.type] = (byType[finding.type] ?? 0) + 1;
  }

  const warnings: string[] = [];
  if (hitLimit) {
    warnings.push(`Match cap reached (${maxMatches}). Output may be incomplete.`);
  }

  const report: ScrubReport = {
    totalFindings: findings.length,
    byType,
    findings: findings.map(({ replacement: _replacement, ...rest }) => rest),
    ...(warnings.length ? { warnings } : {})
  };

  return {
    scrubbedText,
    report,
    mappingJsonl: options.mode === "token-map" ? state.mappingLines.join("\n") : undefined
  };
};

export type { ScrubOptions, ScrubMode, Finding, ScrubReport, ScrubResult } from "./types";
