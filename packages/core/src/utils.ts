export function base64UrlToUtf8(value: string): string | null {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    let binary = "";
    if (typeof atob !== "function") {
      return null;
    }
    binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function hasBoundary(text: string, start: number, end: number, allowed: RegExp): boolean {
  const before = start > 0 ? text[start - 1] : "";
  const after = end < text.length ? text[end] : "";
  if (before && allowed.test(before)) {
    return false;
  }
  if (after && allowed.test(after)) {
    return false;
  }
  return true;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
