export type ScrubMode = "redact" | "token-map" | "hash";

export interface ScrubOptions {
  mode: ScrubMode;
  keepLast?: number;
  aggressive?: boolean;
  hashSalt?: string;
  maxMatches?: number;
}

export interface Finding {
  type: string;
  detector: string;
  start: number;
  end: number;
  confidence: "high" | "medium" | "low";
  replacement: string;
}

export interface ScrubReport {
  totalFindings: number;
  byType: Record<string, number>;
  findings: Array<Omit<Finding, "replacement">>;
}

export interface ScrubResult {
  scrubbedText: string;
  report: ScrubReport;
  mappingJsonl?: string;
}
