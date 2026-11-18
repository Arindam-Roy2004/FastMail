import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { Redis } from "ioredis";
import { HOUR_MS, hourWindow, windowStart } from "../src/common/utils/hour-window.js";
import { createRedisRateLimiter } from "../src/modules/queue/rate-limiter.js";

const url = process.env.REDIS_URL ?? "redis://localhost:6380";
const redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null });
let available = false;

before(async () => {
  available = await redis.connect().then(
    () => true,
    () => false,
  );
});
after(async () => {
  if (available) await redis.quit();
  else redis.disconnect();
});

const T0 = windowStart(hourWindow(Date.UTC(2026, 0, 5, 10)));

describe("redis rate limiter", () => {
  it("hands out a limited number of slots per hour, then moves to the next hour", async (t) => {
    if (!available) return t.skip("Redis not reachable");
    const limiter = createRedisRateLimiter(redis);
    const senderId = randomUUID();
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await limiter.reserve({ senderId, now: T0, limit: 3, gapMs: 1000 }));

    assert.deepEqual(
      results.map((r) => r.sendAt - T0),
      [0, 1000, 2000, HOUR_MS, HOUR_MS + 1000],
    );
    // The third reservation took the last slot; the fourth found the hour full.
    assert.equal(results[2]!.limitHitWindow, hourWindow(T0));
    assert.equal(results[3]!.limitHitWindow, hourWindow(T0));
    assert.equal(results[0]!.limitHitWindow, null);
  });

  it("is atomic under concurrent callers: never more than the limit in one hour", async (t) => {
    if (!available) return t.skip("Redis not reachable");
    const limiter = createRedisRateLimiter(redis);
    const senderId = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 50 }, () => limiter.reserve({ senderId, now: T0, limit: 10, gapMs: 100 })),
    );
    const perWindow = new Map<number, number[]>();
    for (const r of results) perWindow.set(r.window, [...(perWindow.get(r.window) ?? []), r.sendAt]);
    for (const times of perWindow.values()) {
      assert.ok(times.length <= 10);
      // And every send time is unique and at least the gap apart.
      const sorted = [...times].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i]! - sorted[i - 1]! >= 100);
    }
  });

  it("keeps senders independent", async (t) => {
    if (!available) return t.skip("Redis not reachable");
    const limiter = createRedisRateLimiter(redis);
    const a = await limiter.reserve({ senderId: randomUUID(), now: T0, limit: 1, gapMs: 2000 });
    const b = await limiter.reserve({ senderId: randomUUID(), now: T0, limit: 1, gapMs: 2000 });
    assert.equal(a.sendAt, T0);
    assert.equal(b.sendAt, T0);
  });

  it("gives a slot back on release, and never below zero", async (t) => {
    if (!available) return t.skip("Redis not reachable");
    const limiter = createRedisRateLimiter(redis);
    const senderId = randomUUID();
    const first = await limiter.reserve({ senderId, now: T0, limit: 1, gapMs: 10 });
    await limiter.release(senderId, first.window);
    await limiter.release(senderId, first.window);
    const again = await limiter.reserve({ senderId, now: T0, limit: 1, gapMs: 10 });
    assert.equal(again.window, first.window);
  });

  it("lets exactly one caller claim the alert for an hour", async (t) => {
    if (!available) return t.skip("Redis not reachable");
    const limiter = createRedisRateLimiter(redis);
    const senderId = randomUUID();
    const wins = await Promise.all(Array.from({ length: 10 }, () => limiter.claimAlert(senderId, 42)));
    assert.equal(wins.filter(Boolean).length, 1);
  });
});
