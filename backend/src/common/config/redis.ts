import { Redis } from "ioredis";
import { env } from "./env.js";

const url = new URL(env.REDIS_URL);

export const redisConnection = {
  host: url.hostname,
  port: Number(url.port) || 6379,
  ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
  ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
  maxRetriesPerRequest: null,
};

let sharedClient: Redis | null = null;

export const getRedis = () => {
  if (!sharedClient) {
    sharedClient = new Redis(redisConnection);
    sharedClient.on("error", (err) => {
      console.error("Redis connection error:", err.message);
    });
  }
  return sharedClient;
};

export const closeRedis = async () => {
  if (sharedClient) {
    await sharedClient.quit().catch(() => undefined);
    sharedClient = null;
  }
};
