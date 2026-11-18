import "dotenv/config";
import { z } from "zod";

const secret = z.string().min(32, "must be at least 32 characters (openssl rand -hex 32)");
const positiveInt = z.coerce.number().int().positive();
const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  FRONTEND_ORIGIN: z.url().default("http://localhost:5173"),

  DATABASE_URL: z.string().min(1, "is required"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6380"),
  ELASTICSEARCH_URL: z.url().default("http://localhost:9200"),

  JWT_ACCESS_SECRET: secret,
  JWT_REFRESH_SECRET: secret,
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,

  SLACK_CLIENT_ID: optional,
  SLACK_CLIENT_SECRET: optional,
  SLACK_REDIRECT_URI: optional,

  WORKER_CONCURRENCY: positiveInt.max(100).default(5),
  MIN_DELAY_BETWEEN_EMAILS_MS: positiveInt.default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: positiveInt.default(200),
  MAX_RECIPIENTS_PER_REQUEST: positiveInt.max(50_000).default(5000),
  JOB_LOCK_MS: positiveInt.min(10_000).default(60_000),
});

export type Env = z.infer<typeof envSchema>;

const parseEnv = (): Env => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    console.error(`\nInvalid environment configuration:\n${issues}\n`);
    // Exit rather than limp along: every later failure would be harder to read.
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();

export const isProd = env.NODE_ENV === "production";
export const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export const slackConfigured = Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET && env.SLACK_REDIRECT_URI);
