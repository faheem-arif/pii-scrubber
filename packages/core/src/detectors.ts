import { shannonEntropy } from "./entropy";
import { base64UrlToUtf8, hasBoundary } from "./utils";
import type { ScrubOptions } from "./types";

export interface CandidateFinding {
  type: string;
  detector: string;
  start: number;
  end: number;
  confidence: "high" | "medium" | "low";
  severity: number;
}

const SEVERITY_BY_TYPE: Record<string, number> = {
  private_key: 4,
  jwt: 4,
  github_token: 4,
  aws_access_key: 4,
  url_basic_auth: 3,
  generic_secret: 3,
  email: 1,
  ipv4: 1,
  ipv6: 1,
  uuid: 1
};

const KEYWORDS = [
  "api_key",
  "apikey",
  "token",
  "secret",
  "password",
  "passwd",
  "pwd",
  "access_key",
  "auth",
  "bearer"
];

const EMAIL_ALLOWED = /[A-Za-z0-9_%+-]/;
const TOKEN_ALLOWED = /[A-Za-z0-9+/_=-]/;
const HEX_COLON_ALLOWED = /[0-9A-Fa-f:]/;
const ALNUM_ALLOWED = /[A-Za-z0-9]/;

const addCandidate = (
  candidates: CandidateFinding[],
  candidate: CandidateFinding,
  maxMatches: number
): boolean => {
  if (candidates.length >= maxMatches) {
    return false;
  }
  candidates.push(candidate);
  return candidates.length < maxMatches;
};

const candidate = (
  type: string,
  detector: string,
  start: number,
  end: number,
  confidence: "high" | "medium" | "low"
): CandidateFinding => ({
  type,
  detector,
  start,
  end,
  confidence,
  severity: SEVERITY_BY_TYPE[type] ?? 1
});

const isValidIPv4 = (value: string): boolean => {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (part.length === 0 || part.length > 3) {
      return false;
    }
    if (!/^[0-9]+$/.test(part)) {
      return false;
    }
    const num = Number(part);
    return num >= 0 && num <= 255;
  });
};

const isValidIPv6 = (value: string): boolean => {
  if (!value.includes(":")) {
    return false;
  }
  if (value.includes(".")) {
    return false;
  }
  const parts = value.split("::");
  if (parts.length > 2) {
    return false;
  }
  const left = parts[0] ? parts[0].split(":").filter(Boolean) : [];
  const right = parts[1] ? parts[1].split(":").filter(Boolean) : [];
  if (parts.length === 1 && left.length !== 8) {
    return false;
  }
  if (parts.length === 2 && left.length + right.length > 7) {
    return false;
  }
  const all = [...left, ...right];
  return all.every((segment) => /^[0-9A-Fa-f]{1,4}$/.test(segment));
};

const hasKeywordNearby = (text: string, start: number, end: number): boolean => {
  const windowStart = Math.max(0, start - 64);
  const windowEnd = Math.min(text.length, end + 32);
  const context = text.slice(windowStart, windowEnd).toLowerCase();
  return KEYWORDS.some((keyword) => context.includes(keyword));
};

const decodeJwtHeader = (segment: string): Record<string, unknown> | null => {
  const decoded = base64UrlToUtf8(segment);
  if (!decoded) {
    return null;
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
};

export const detectAll = (text: string, options: ScrubOptions): CandidateFinding[] => {
  const maxMatches = options.maxMatches ?? 5000;
  const candidates: CandidateFinding[] = [];

  const privateKeyRegex =
    /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]+?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g;
  for (const match of text.matchAll(privateKeyRegex)) {
    if (!addCandidate(candidates, candidate("private_key", "pem_private_key", match.index ?? 0, (match.index ?? 0) + match[0].length, "high"), maxMatches)) {
      return candidates;
    }
  }

  const jwtRegex = /[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
  for (const match of text.matchAll(jwtRegex)) {
    const index = match.index ?? 0;
    const value = match[0];
    const [header] = value.split(".");
    const decodedHeader = decodeJwtHeader(header);
    if (!decodedHeader || typeof decodedHeader.alg !== "string") {
      continue;
    }
    if (!addCandidate(candidates, candidate("jwt", "jwt_structural", index, index + value.length, "high"), maxMatches)) {
      return candidates;
    }
  }

  const githubRegexes = [
    /gh[pousr]_[A-Za-z0-9]{36,}/g,
    /github_pat_[A-Za-z0-9_]{22,}/g
  ];
  for (const regex of githubRegexes) {
    for (const match of text.matchAll(regex)) {
      const index = match.index ?? 0;
      const value = match[0];
      if (!hasBoundary(text, index, index + value.length, ALNUM_ALLOWED)) {
        continue;
      }
      if (!addCandidate(candidates, candidate("github_token", "github_token", index, index + value.length, "high"), maxMatches)) {
        return candidates;
      }
    }
  }

  const awsRegex = /A(KIA|SIA|GPA|IDA|NPA|NVA|RIA|ROA)[A-Z0-9]{16}/g;
  for (const match of text.matchAll(awsRegex)) {
    const index = match.index ?? 0;
    const value = match[0];
    if (!hasBoundary(text, index, index + value.length, ALNUM_ALLOWED)) {
      continue;
    }
    if (!addCandidate(candidates, candidate("aws_access_key", "aws_access_key", index, index + value.length, "high"), maxMatches)) {
      return candidates;
    }
  }

  const basicAuthRegex = /https?:\/\/[^/\s:]+:[^/\s@]+@[^/\s]+(?:\/[^\s]*)?/g;
  for (const match of text.matchAll(basicAuthRegex)) {
    const index = match.index ?? 0;
    const value = match[0];
    if (!addCandidate(candidates, candidate("url_basic_auth", "url_basic_auth", index, index + value.length, "high"), maxMatches)) {
      return candidates;
    }
  }

  const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  for (const match of text.matchAll(emailRegex)) {
    const index = match.index ?? 0;
    const value = match[0];
    if (!hasBoundary(text, index, index + value.length, EMAIL_ALLOWED)) {
      continue;
    }
    if (!addCandidate(candidates, candidate("email", "email", index, index + value.length, "high"), maxMatches)) {
      return candidates;
    }
  }

  const ipv4Regex = /[0-9]{1,3}(?:\.[0-9]{1,3}){3}/g;
  for (const match of text.matchAll(ipv4Regex)) {
    const index = match.index ?? 0;
    const value = match[0];
    if (!hasBoundary(text, index, index + value.length, /[0-9.]/)) {
      continue;
    }
    if (!isValidIPv4(value)) {
      continue;
    }
    if (!addCandidate(candidates, candidate("ipv4", "ipv4", index, index + value.length, "high"), maxMatches)) {
      return candidates;
    }
  }

  const ipv6Regex = /[0-9A-Fa-f:]{2,}/g;
  for (const match of text.matchAll(ipv6Regex)) {
    const index = match.index ?? 0;
    const value = match[0];
    if (value.length < 6 || !value.includes(":")) {
      continue;
    }
    if (!hasBoundary(text, index, index + value.length, HEX_COLON_ALLOWED)) {
      continue;
    }
    if (!isValidIPv6(value)) {
      continue;
    }
    if (!addCandidate(candidates, candidate("ipv6", "ipv6", index, index + value.length, "high"), maxMatches)) {
      return candidates;
    }
  }

  const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g;
  for (const match of text.matchAll(uuidRegex)) {
    const index = match.index ?? 0;
    const value = match[0];
    if (!addCandidate(candidates, candidate("uuid", "uuid", index, index + value.length, "high"), maxMatches)) {
      return candidates;
    }
  }

  const tokenRegex = /[A-Za-z0-9+/_=-]{16,128}/g;
  for (const match of text.matchAll(tokenRegex)) {
    let index = match.index ?? 0;
    let value = match[0];
    if (!hasBoundary(text, index, index + value.length, TOKEN_ALLOWED)) {
      continue;
    }

    const equalsIndex = value.indexOf("=");
    if (equalsIndex > 0) {
      const prefix = value.slice(0, equalsIndex).toLowerCase();
      if (KEYWORDS.includes(prefix)) {
        index += equalsIndex + 1;
        value = value.slice(equalsIndex + 1);
      }
    }

    const hasKeyword = hasKeywordNearby(text, index, index + value.length);
    const entropy = shannonEntropy(value);
    const isHex = /^[0-9a-fA-F]+$/.test(value);
    const minLength = options.aggressive ? 16 : 20;
    const minEntropy = options.aggressive ? 3.2 : 3.6;

    let confidence: "high" | "medium" | "low" = "low";
    if (value.length >= minLength && entropy >= minEntropy && (hasKeyword || options.aggressive)) {
      confidence = hasKeyword ? "high" : "medium";
    }

    if (confidence === "low") {
      continue;
    }

    if (isHex && !hasKeyword && value.length < 32) {
      continue;
    }

    if (!addCandidate(candidates, candidate("generic_secret", "entropy_keyword", index, index + value.length, confidence), maxMatches)) {
      return candidates;
    }
  }

  return candidates;
};
