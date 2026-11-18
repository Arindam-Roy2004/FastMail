import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { toIssues } from "../src/common/dto/base.dto.js";
import { buildScheduleEmailsSchema } from "../src/modules/email/dto/schedule-emails.schema.js";

const schema = buildScheduleEmailsSchema(5);

const valid = () => ({
  idempotencyKey: randomUUID(),
  subject: "Hello",
  body: "<p>Hi</p>",
  recipients: ["a@example.com"],
  senderIds: [randomUUID()],
  startAt: new Date(Date.now() + 60_000).toISOString(),
  delayMs: 2000,
  hourlyLimit: 100,
});

const issuesFor = (input: unknown) => {
  const result = schema.safeParse(input);
  assert.equal(result.success, false);
  return toIssues(result.error!);
};

describe("schedule emails DTO", () => {
  it("accepts a valid request and normalises recipients", () => {
    const parsed = schema.parse({ ...valid(), recipients: [" A@Example.com ", "a@example.com", "b@example.com"] });
    assert.deepEqual(parsed.recipients, ["a@example.com", "b@example.com"]);
    assert.ok(parsed.startAt instanceof Date);
  });

  it("points at the exact bad recipient", () => {
    const issues = issuesFor({ ...valid(), recipients: ["ok@example.com", "ok2@example.com", "nope"] });
    assert.deepEqual(issues.map((i) => i.path), ["recipients.2"]);
  });

  it("rejects unknown keys by name, so userId or status cannot be set", () => {
    const issues = issuesFor({ ...valid(), userId: "x", status: "sent" });
    assert.deepEqual(issues.map((i) => i.path).sort(), ["status", "userId"]);
  });

  it("refuses a subject with a line break (header injection)", () => {
    const issues = issuesFor({ ...valid(), subject: "Hi\r\nBcc: evil@example.com" });
    assert.equal(issues[0]!.path, "subject");
  });

  it("enforces the recipient ceiling", () => {
    const recipients = Array.from({ length: 6 }, (_, i) => `r${i}@example.com`);
    assert.equal(issuesFor({ ...valid(), recipients })[0]!.path, "recipients");
  });

  it("rejects duplicate sender ids, bad dates and non-positive numbers", () => {
    const id = randomUUID();
    const paths = issuesFor({ ...valid(), senderIds: [id, id], startAt: "tomorrow", delayMs: 0, hourlyLimit: 1.5 }).map(
      (i) => i.path,
    );
    assert.deepEqual(paths.sort(), ["delayMs", "hourlyLimit", "senderIds", "startAt"]);
  });

  it("rejects a start time more than a year out", () => {
    const far = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(issuesFor({ ...valid(), startAt: far })[0]!.path, "startAt");
  });
});
