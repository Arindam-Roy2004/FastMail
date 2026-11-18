import type { Redis } from "ioredis";
import { HOUR_MS } from "../../common/utils/hour-window.js";

export type Reservation = {
  sendAt: number;
  window: number;
  count: number;
  limitHitWindow: number | null;
};

export type ReserveInput = { senderId: string; now: number; limit: number; gapMs: number };

export type RateLimiter = {
  reserve(input: ReserveInput): Promise<Reservation>;
  release(senderId: string, window: number): Promise<void>;
  claimAlert(senderId: string, window: number): Promise<boolean>;
};

const MAX_WINDOWS_AHEAD = 24 * 14;

const RESERVE_LUA = `
local sender = ARGV[1]
local now = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local gap = tonumber(ARGV[4])
local hour = tonumber(ARGV[5])
local maxAhead = tonumber(ARGV[6])
local prefix = 'rl:' .. sender .. ':'
local w = math.floor(now / hour)
local hitWindow = -1

for i = 0, maxAhead do
  local countKey = prefix .. 'count:' .. w
  local lastKey = prefix .. 'last:' .. w
  local count = tonumber(redis.call('GET', countKey) or '0')
  local startAt = w * hour
  local endAt = startAt + hour
  local t = math.max(now, startAt)
  local last = redis.call('GET', lastKey)
  if last then t = math.max(t, tonumber(last) + gap) end
  local prevLast = redis.call('GET', prefix .. 'last:' .. (w - 1))
  if prevLast then t = math.max(t, tonumber(prevLast) + gap) end

  if count < limit and t < endAt then
    count = redis.call('INCR', countKey)
    redis.call('SET', lastKey, t)
    local ttl = math.ceil((endAt + hour - now) / 1000)
    redis.call('EXPIRE', countKey, ttl)
    redis.call('EXPIRE', lastKey, ttl)
    if count >= limit and hitWindow == -1 then hitWindow = w end
    return { t, w, count, hitWindow }
  end

  if count >= limit and hitWindow == -1 then hitWindow = w end
  w = w + 1
end

return { -1, -1, 0, hitWindow }
`;

// Never drops below zero, so a double release cannot hand out extra slots.
const RELEASE_LUA = `
local v = tonumber(redis.call('GET', KEYS[1]) or '0')
if v > 0 then return redis.call('DECR', KEYS[1]) end
return 0
`;

export const createRedisRateLimiter = (redis: Redis): RateLimiter => ({
  async reserve({ senderId, now, limit, gapMs }) {
    const result = (await redis.eval(
      RESERVE_LUA,
      0,
      senderId,
      String(Math.floor(now)),
      String(limit),
      String(gapMs),
      String(HOUR_MS),
      String(MAX_WINDOWS_AHEAD),
    )) as [number, number, number, number];
    const [sendAt, window, count, hitWindow] = result;
    if (window < 0) throw new Error(`No free slot for sender ${senderId} in the next ${MAX_WINDOWS_AHEAD} hours`);
    return { sendAt, window, count, limitHitWindow: hitWindow >= 0 ? hitWindow : null };
  },

  async release(senderId, window) {
    await redis.eval(RELEASE_LUA, 1, `rl:${senderId}:count:${window}`);
  },

  async claimAlert(senderId, window) {
    // NX: only the first caller wins; the key outlives the window by an hour.
    const result = await redis.set(`rl:${senderId}:alert:${window}`, "1", "PX", 2 * HOUR_MS, "NX");
    return result === "OK";
  },
});
