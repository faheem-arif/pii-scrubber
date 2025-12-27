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
  slack_webhook: 4,
  github_token: 4,
  aws_access_key: 4,
  aws_secret_access_key: 4,
  aws_session_token: 4,
  url_basic_auth: 3,
  password: 3,
  cookie: 3,
  generic_secret: 2,
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
  "bearer",
  "session",
  "session_id",
  "sid",
  "csrf"
];

const SECRET_KEY_NAMES = [
  "api_key",
  "apikey",
  "token",
  "secret",
  "password",
  "passwd",
  "pwd",
  "access_key",
  "accesskey",
  "auth",
  "authorization",
  "bearer",
  "session",
  "session_id",
  "sid",
  "csrf",
  "xsrf",
  "client_secret",
  "access_token",
  "refresh_token",
  "aws_secret_access_key",
  "aws_session_token",
  "aws_access_key_id",
  "github_token",
  "npm_token",
  "slack_webhook_url"
];

const GENERIC_SECRET_DENYLIST_KEYS = ["requesturi", "request_uri", "endpoint", "path", "url", "uri"];

const COOKIE_SECRET_KEYS = [
  "session",
  "session_id",
  "sid",
  "auth",
  "token",
  "jwt",
  "bearer",
  "csrf",
  "xsrf",
  "access_token",
  "refresh_token"
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

const hasKeywordOutside = (text: string, start: number, end: number): boolean => {
  const windowStart = Math.max(0, start - 64);
  const windowEnd = Math.min(text.length, end + 32);
  const before = text.slice(windowStart, start).toLowerCase();
  const after = text.slice(end, windowEnd).toLowerCase();
  return KEYWORDS.some((keyword) => before.includes(keyword) || after.includes(keyword));
};

const getKeyNameBefore = (text: string, start: number): string | null => {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const segment = text.slice(lineStart, start);
  const match = /([A-Za-z0-9_.-]{1,64})\s*(?::|=)\s*["']?$/.exec(segment);
  return match ? match[1].toLowerCase() : null;
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

const UUID_REGEX = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g;

const isUuidLike = (value: string): boolean =>
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);

const addKeyValueCandidates = (
  text: string,
  regex: RegExp,
  type: string,
  detector: string,
  candidates: CandidateFinding[],
  maxMatches: number,
  confidence: "high" | "medium" | "low" = "high"
): boolean => {
  for (const match of text.matchAll(regex)) {
    const value = match[1];
    if (!value) {
      continue;
    }
    const index = match.index ?? 0;
    const valueOffset = match[0].indexOf(value);
    if (valueOffset < 0) {
      continue;
    }
    const start = index + valueOffset;
    const end = start + value.length;
    if (!addCandidate(candidates, candidate(type, detector, start, end, confidence), maxMatches)) {
      return false;
    }
  }
  return true;
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

  const slackWebhookRegex = /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+/g;
  for (const match of text.matchAll(slackWebhookRegex)) {
    const index = match.index ?? 0;
    const value = match[0];
    if (!addCandidate(candidates, candidate("slack_webhook", "slack_webhook", index, index + value.length, "high"), maxMatches)) {
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

  const awsSecretRegex = /AWS_SECRET_ACCESS_KEY\s*=\s*([A-Za-z0-9/+=]{16,})/g;
  if (!addKeyValueCandidates(text, awsSecretRegex, "aws_secret_access_key", "aws_secret_access_key", candidates, maxMatches)) {
    return candidates;
  }

  const awsSessionRegex = /AWS_SESSION_TOKEN\s*=\s*([A-Za-z0-9/+=]{16,})/g;
  if (!addKeyValueCandidates(text, awsSessionRegex, "aws_session_token", "aws_session_token", candidates, maxMatches)) {
    return candidates;
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
    if (!hasBoundary(text, index, index + value.length, /[0-9]/)) {
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

  for (const match of text.matchAll(UUID_REGEX)) {
    const index = match.index ?? 0;
    const value = match[0];
    if (!addCandidate(candidates, candidate("uuid", "uuid", index, index + value.length, "high"), maxMatches)) {
      return candidates;
    }
  }

  const passwordRegex = /\b(?:Password|Pwd)\s*=\s*(".*?"|'.*?'|[^;\s]+)/gi;
  if (!addKeyValueCandidates(text, passwordRegex, "password", "connection_string_password", candidates, maxMatches)) {
    return candidates;
  }

  const cookieHeaderRegex = /^Cookie:\s*([^\r\n]*)/gmi;
  for (const match of text.matchAll(cookieHeaderRegex)) {
    const cookieLine = match[1] ?? "";
    if (!cookieLine) {
      continue;
    }
    const lineStart = (match.index ?? 0) + match[0].indexOf(cookieLine);
    const kvRegex = /\s*([A-Za-z0-9_.-]{1,64})=([^;]*)/g;
    for (const kvMatch of cookieLine.matchAll(kvRegex)) {
      const key = kvMatch[1]?.toLowerCase();
      const value = kvMatch[2] ?? "";
      if (!key || !value) {
        continue;
      }
      if (!COOKIE_SECRET_KEYS.includes(key)) {
        continue;
      }
      const valueOffset = kvMatch[0].indexOf(value);
      if (valueOffset < 0) {
        continue;
      }
      const start = lineStart + (kvMatch.index ?? 0) + valueOffset;
      const end = start + value.length;
      if (!addCandidate(candidates, candidate("cookie", "cookie_header", start, end, "high"), maxMatches)) {
        return candidates;
      }
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
      if (SECRET_KEY_NAMES.includes(prefix)) {
        index += equalsIndex + 1;
        value = value.slice(equalsIndex + 1);
      }
    }

    if (isUuidLike(value)) {
      continue;
    }

    const keyName = getKeyNameBefore(text, index);
    if (keyName && GENERIC_SECRET_DENYLIST_KEYS.includes(keyName)) {
      continue;
    }
    const hasKeyword = hasKeywordOutside(text, index, index + value.length);
    const hasSecretKey = keyName ? SECRET_KEY_NAMES.includes(keyName) : false;
    const entropy = shannonEntropy(value);
    const isHex = /^[0-9a-fA-F]+$/.test(value);
    const minLength = options.aggressive ? 16 : 20;
    const minEntropy = options.aggressive ? 3.2 : 3.6;

    let confidence: "high" | "medium" | "low" = "low";
    if (
      value.length >= minLength &&
      entropy >= minEntropy &&
      (hasKeyword || hasSecretKey || options.aggressive)
    ) {
      confidence = hasKeyword || hasSecretKey ? "high" : "medium";
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
