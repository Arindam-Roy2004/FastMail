import { Client } from "@elastic/elasticsearch";
import { env } from "./env.js";

export const elastic = new Client({
  node: env.ELASTICSEARCH_URL,
  requestTimeout: 5000,
  maxRetries: 1,
});
