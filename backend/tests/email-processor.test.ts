import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { DelayedError } from "bullmq";
import { HOUR_MS, hourWindow } from "../src/common/utils/hour-window.js";
import type { Mailer } from "../src/modules/mail/mailer.js";
import type { EmailJobData } from "../src/modules/queue/email-job.js";
import type { ClaimResult, EmailStore } from "../src/modules/queue/email-store.js";
import { createEmailProcessor, type EmailJob, type RateLimitAlert } from "../src/modules/queue/email.processor.js";
import type { RateLimiter, Reservation } from "../src/modules/queue/rate-limiter.js";

const EMAIL_ID = "0b5c7c1e-4f6a-4d55-9b1c-2a0a3d6f7e81";
const NOW = Date.UTC(2026, 0, 5, 10, 15);

const claimed: ClaimResult = {
  kind: "claimed",
  email: {
    id: EMAIL_ID,
    userId: "user-1",
    to: "to@example.com",
    subject: "Subject",
    html: "<p>Hi</p>",
    text: "Hi",
    hourlyLimit: 50,
    sender: { id: "sender-1", name: "S", email: "s@example.com", smtpHost: "h", smtpPort: 587, smtpUser: "u", smtpPass: "p" },
  },
};

type Calls = { store: string[]; limiter: string[]; sent: number; alerts: RateLimitAlert[]; movedTo: number[]; data: EmailJobData[] };

const setup = (opts: {
  claim?: ClaimResult;
  reservation?: Partial<Reservation>;
  sendError?: Error;
  attemptsMade?: number;
  data?: Partial<EmailJobData>;
  alertWins?: boolean;
}) => {
  const calls: Calls = { store: [], limiter: [], sent: 0, alerts: [], movedTo: [], data: [] };
  const store: EmailStore = {
    claim: async () => {
      calls.store.push("claim");
      return opts.claim ?? claimed;
    },
    release: async () => void calls.store.push("release"),
    defer: async (_id, at) => void calls.store.push(`defer:${at.getTime()}`),
    markSent: async () => void calls.store.push("markSent"),
    markFailed: async (_id, error) => void calls.store.push(`markFailed:${error}`),
  };
  const limiter: RateLimiter = {
    reserve: async () => {
      calls.limiter.push("reserve");
      return { sendAt: NOW, window: hourWindow(NOW), count: 1, limitHitWindow: null, ...opts.reservation };
    },
    release: async (_s, w) => void calls.limiter.push(`release:${w}`),
    claimAlert: async () => opts.alertWins ?? true,
  };
  const mailer: Mailer = {
    send: async () => {
      if (opts.sendError) throw opts.sendError;
      calls.sent++;
      return { messageId: "<m@x>", previewUrl: null };
    },
  };
  const job: EmailJob = {
    id: EMAIL_ID,
    data: { emailId: EMAIL_ID, ...opts.data },
    attemptsMade: opts.attemptsMade ?? 0,
    opts: { attempts: 3 },
    moveToDelayed: async (at: number) => void calls.movedTo.push(at),
    updateData: async (data: EmailJobData) => void calls.data.push(data),
  } as EmailJob;
  const processor = createEmailProcessor({
    store,
    mailer,
    limiter,
    notifier: { rateLimitReached: async (alert) => void calls.alerts.push(alert) },
    indexer: { index: async () => undefined },
    config: { gapMs: 2000, maxPerHour: 200, lockMs: 60_000 },
    now: () => NOW,
    sleep: async () => undefined,
  });
  return { calls, run: () => processor(job, "token") };
};

describe("email processor", () => {
  let warn: typeof console.error;
  beforeEach(() => {
    warn = console.error;
  });

  it("sends once and records it", async () => {
    const { calls, run } = setup({});
    assert.deepEqual(await run(), { outcome: "sent", messageId: "<m@x>" });
    assert.equal(calls.sent, 1);
    assert.deepEqual(calls.store, ["claim", "markSent"]);
  });

  it("skips a redelivered job whose email is already sent", async () => {
    const { calls, run } = setup({ claim: { kind: "done" } });
    assert.deepEqual(await run(), { outcome: "skipped", reason: "already-done" });
    assert.equal(calls.sent, 0);
    assert.deepEqual(calls.limiter, []);
  });

  it("never completes a job another worker is holding: it is delayed until the lock expires", async () => {
    const { calls, run } = setup({ claim: { kind: "busy" } });
    await assert.rejects(run, DelayedError);
    assert.deepEqual(calls.movedTo, [NOW + 60_000]);
    assert.equal(calls.sent, 0);
  });

  it("defers into the reserved hour when the current one is full, without failing", async () => {
    const later = NOW + HOUR_MS;
    const { calls, run } = setup({ reservation: { sendAt: later, window: hourWindow(later) } });
    await assert.rejects(run, DelayedError);
    assert.deepEqual(calls.movedTo, [later]);
    assert.ok(calls.store.includes(`defer:${later}`));
    assert.ok(!calls.store.some((c) => c.startsWith("markFailed")));
    assert.deepEqual(calls.data[0], { emailId: EMAIL_ID, reservedWindow: hourWindow(later), reservedAt: later });
  });

  it("a deferral on the last attempt is still not a failure", async () => {
    const later = NOW + HOUR_MS;
    const { calls, run } = setup({ attemptsMade: 2, reservation: { sendAt: later, window: hourWindow(later) } });
    await assert.rejects(run, DelayedError);
    assert.ok(!calls.store.some((c) => c.startsWith("markFailed")));
    assert.deepEqual(calls.limiter, ["reserve"]);
  });

  it("reuses a slot it already holds instead of reserving again", async () => {
    const { calls, run } = setup({ data: { reservedWindow: hourWindow(NOW), reservedAt: NOW - 10 } });
    await run();
    assert.deepEqual(calls.limiter, []);
    assert.equal(calls.sent, 1);
  });

  it("alerts once when it takes the last slot of the hour", async () => {
    const { calls, run } = setup({ reservation: { limitHitWindow: hourWindow(NOW) } });
    await run();
    assert.equal(calls.alerts.length, 1);
    assert.equal(calls.alerts[0]!.senderEmail, "s@example.com");
    assert.equal(calls.alerts[0]!.resumesAt.getTime(), (hourWindow(NOW) + 1) * HOUR_MS);
  });

  it("does not alert when another worker already won the alert", async () => {
    const { calls, run } = setup({ reservation: { limitHitWindow: hourWindow(NOW) }, alertWins: false });
    await run();
    assert.equal(calls.alerts.length, 0);
  });

  it("releases the claim on a failed attempt so the retry can claim again", async () => {
    console.error = () => undefined;
    const { calls, run } = setup({ sendError: new Error("SMTP down"), attemptsMade: 0 });
    await assert.rejects(run, /SMTP down/);
    console.error = warn;
    assert.deepEqual(calls.store, ["claim", "release"]);
    assert.deepEqual(calls.limiter, ["reserve"]);
  });

  it("marks failed and gives the slot back on the last attempt", async () => {
    const { calls, run } = setup({ sendError: new Error("SMTP down"), attemptsMade: 2 });
    await assert.rejects(run, /SMTP down/);
    assert.deepEqual(calls.store, ["claim", "markFailed:SMTP down"]);
    assert.deepEqual(calls.limiter, ["reserve", `release:${hourWindow(NOW)}`]);
  });

  it("refuses a malformed payload without retrying", async () => {
    const { run } = setup({ data: { emailId: "not-a-uuid" } });
    await assert.rejects(run, (err: Error) => err.name === "UnrecoverableError");
  });
});
