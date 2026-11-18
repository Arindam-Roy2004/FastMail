import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HOUR_MS, hourWindow, windowStart } from "../src/common/utils/hour-window.js";
import { planSchedule } from "../src/modules/queue/slot-planner.js";

// 10:00:00 UTC on an arbitrary day, so window maths is easy to read.
const T0 = windowStart(hourWindow(Date.UTC(2026, 0, 5, 10)));

describe("planSchedule", () => {
  it("spaces emails by the delay and rotates senders", () => {
    const plan = planSchedule({ startAt: T0, delayMs: 2000, hourlyLimit: 100, senderIds: ["a", "b"], count: 4 });
    assert.deepEqual(
      plan.map((p) => [p.senderId, p.scheduledAt - T0]),
      [
        ["a", 0],
        ["b", 2000],
        ["a", 4000],
        ["b", 6000],
      ],
    );
  });

  it("moves overflow into the next hour, keeping order and spacing", () => {
    const plan = planSchedule({ startAt: T0, delayMs: 1000, hourlyLimit: 3, senderIds: ["a"], count: 7 });
    const offsets = plan.map((p) => p.scheduledAt - T0);
    assert.deepEqual(offsets, [0, 1000, 2000, HOUR_MS, HOUR_MS + 1000, HOUR_MS + 2000, 2 * HOUR_MS]);
    // Strictly increasing: campaign order is kept.
    for (let i = 1; i < offsets.length; i++) assert.ok(offsets[i]! > offsets[i - 1]!);
  });

  it("lays 1000 emails at 200/hour over five hours", () => {
    const plan = planSchedule({ startAt: T0, delayMs: 2000, hourlyLimit: 200, senderIds: ["a"], count: 1000 });
    const perWindow = new Map<number, number>();
    for (const p of plan) perWindow.set(hourWindow(p.scheduledAt), (perWindow.get(hourWindow(p.scheduledAt)) ?? 0) + 1);
    assert.equal(perWindow.size, 5);
    for (const count of perWindow.values()) assert.equal(count, 200);
  });

  it("counts the limit per sender, not per campaign", () => {
    const plan = planSchedule({ startAt: T0, delayMs: 1000, hourlyLimit: 2, senderIds: ["a", "b"], count: 4 });
    // Two senders x two each: everything fits in the first hour.
    assert.ok(plan.every((p) => hourWindow(p.scheduledAt) === hourWindow(T0)));
  });

  it("never places two emails of one sender closer than the delay", () => {
    const plan = planSchedule({ startAt: T0 + HOUR_MS - 1500, delayMs: 1000, hourlyLimit: 1, senderIds: ["a"], count: 3 });
    for (let i = 1; i < plan.length; i++) assert.ok(plan[i]!.scheduledAt - plan[i - 1]!.scheduledAt >= 1000);
  });

  it("rejects an empty sender list", () => {
    assert.throws(() => planSchedule({ startAt: T0, delayMs: 1000, hourlyLimit: 1, senderIds: [], count: 1 }));
  });
});
