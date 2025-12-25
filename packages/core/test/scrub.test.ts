import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { scrubText } from "../src/index";

const fixturesDir = resolve(fileURLToPath(new URL("../../../fixtures", import.meta.url)));

const readFixture = (name: string) => readFileSync(resolve(fixturesDir, name), "utf8");

describe("scrubText", () => {
  it("redact mode matches fixture", () => {
    const input = readFixture("input.txt");
    const expected = readFixture("expected-redact.txt");
    const result = scrubText(input, { mode: "redact" });
    expect(result.scrubbedText).toBe(expected);
  });

  describe("token-map mode", () => {
    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-12-25T12:34:56Z"));
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it("matches scrubbed output fixture", () => {
      const input = readFixture("input.txt");
      const expected = readFixture("expected-token-map.txt");
      const result = scrubText(input, { mode: "token-map" });
      expect(result.scrubbedText).toBe(expected);
    });

    it("produces deterministic mapping jsonl", () => {
      const input = readFixture("input.txt");
      const expectedMapping = readFixture("expected-token-map.jsonl").trim().split("\n");
      const result = scrubText(input, { mode: "token-map" });
      const actualMapping = result.mappingJsonl?.trim().split("\n") ?? [];
      expect(actualMapping).toEqual(expectedMapping);
    });
  });

  it("hash mode matches fixture", () => {
    const input = readFixture("input.txt");
    const expected = readFixture("expected-hash.txt");
    const result = scrubText(input, { mode: "hash", hashSalt: "test-salt" });
    expect(result.scrubbedText).toBe(expected);
  });

  it("prefers higher severity on overlaps", () => {
    const input = readFixture("overlap-input.txt");
    const expected = readFixture("overlap-expected-redact.txt");
    const result = scrubText(input, { mode: "redact" });
    expect(result.scrubbedText).toBe(expected);
  });
});
