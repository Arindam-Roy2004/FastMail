import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { env } from "./env.js";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

// One client per process. The API and the worker each import this module once.
export const db = new PrismaClient({ adapter });

export const connectDB = async () => {
  await db.$connect();
  // $connect is lazy with driver adapters; a real round trip proves the URL works.
  await db.$queryRaw`SELECT 1`;
  console.log("Postgres connected");
};
