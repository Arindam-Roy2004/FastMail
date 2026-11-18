import { hourWindow, windowStart } from "../../common/utils/hour-window.js";

export type PlanInput = {
  startAt: number;
  delayMs: number;
  hourlyLimit: number;
  senderIds: string[];
  count: number;
};

export type PlannedEmail = { seq: number; senderId: string; scheduledAt: number };

type SenderState = { next: number; perWindow: Map<number, number> };

export const planSchedule = ({ startAt, delayMs, hourlyLimit, senderIds, count }: PlanInput): PlannedEmail[] => {
  if (senderIds.length === 0) throw new Error("planSchedule needs at least one sender");
  if (hourlyLimit < 1) throw new Error("planSchedule needs an hourly limit of at least 1");

  const states = new Map<string, SenderState>();
  const planned: PlannedEmail[] = [];

  for (let seq = 0; seq < count; seq++) {
    const senderId = senderIds[seq % senderIds.length]!;
    let state = states.get(senderId);
    if (!state) {
      state = { next: Number.NEGATIVE_INFINITY, perWindow: new Map() };
      states.set(senderId, state);
    }

    let at = Math.max(startAt + seq * delayMs, state.next);
    let window = hourWindow(at);
    while ((state.perWindow.get(window) ?? 0) >= hourlyLimit) {
      window += 1;
      at = Math.max(at, windowStart(window));
    }

    state.perWindow.set(window, (state.perWindow.get(window) ?? 0) + 1);
    state.next = at + delayMs;
    planned.push({ seq, senderId, scheduledAt: at });
  }

  return planned;
};
