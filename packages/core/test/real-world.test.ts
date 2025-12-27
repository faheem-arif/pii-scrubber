import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scrubText } from "../src/index";

const fixturesRoot = resolve(fileURLToPath(new URL("../../../fixtures/real_world", import.meta.url)));
const originalDir = resolve(fixturesRoot, "original");
const expectedDir = resolve(fixturesRoot, "expected");

const slackWebhook = `https://${["hooks", "slack.com"].join(".")}/services/${[
  "T00000000",
  "B00000000",
  "XXXXXXXXXXXXXXXXXXXXXXXX"
].join("/")}`;

const readFixture = (dir: string, name: string) => {
  const content = readFileSync(resolve(dir, name), "utf8");
  if (dir === originalDir && name === "05_github_actions.log") {
    return content.replace("{{SLACK_WEBHOOK_URL}}", slackWebhook);
  }
  return content;
};

const forbiddenStrings = [
  "AWS_SESSION_TOKEN=IQoJ",
  "hooks.slack.com/services/",
  "Password=MyS3cr3tP@ss",
  "session_id=Hk3V9pQ1",
  "e9b1b2d3-4c5d-6e7f-8a9b-0c1d2e3f4a5b"
];

const requiredStrings = [
  "[AWS_SESSION_TOKEN_REDACTED]",
  "[SLACK_WEBHOOK_REDACTED]",
  "[PASSWORD_REDACTED]",
  "[COOKIE_REDACTED]",
  "\"requestURI\":\"/api/v1/namespaces/default/secrets\""
];

describe("real-world fixtures", () => {
  const files = readdirSync(originalDir).filter((file) => file.endsWith(".log"));

  it("redacts sensitive data without truncating output", () => {
    for (const file of files) {
      const input = readFixture(originalDir, file);
      const expected = readFixture(expectedDir, file.replace(".log", "_scrubbed.log"));
      const result = scrubText(input, { mode: "redact" });
      expect(result.scrubbedText).toBe(expected);
      expect(result.scrubbedText).not.toContain("...");
    }
  });

  it("removes known sensitive values", () => {
    const joined = files
      .map((file) => scrubText(readFixture(originalDir, file), { mode: "redact" }).scrubbedText)
      .join("\n");

    for (const value of forbiddenStrings) {
      expect(joined).not.toContain(value);
    }
    for (const value of requiredStrings) {
      expect(joined).toContain(value);
    }
  });
});
