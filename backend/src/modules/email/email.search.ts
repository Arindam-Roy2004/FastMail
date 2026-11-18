import type { estypes } from "@elastic/elasticsearch";
import { db } from "../../common/config/db.js";
import { elastic } from "../../common/config/elastic.js";
import type { EmailStatus } from "../../generated/prisma/client.js";
import type { EmailIndexer } from "../queue/email.processor.js";

export const EMAIL_INDEX = "emails";

// Indexed body is capped: search needs the words, not a 200kb copy per recipient.
const MAX_INDEXED_BODY = 10_000;
const BULK_CHUNK = 1000;

type EmailDoc = {
  userId: string;
  campaignId: string;
  to: string;
  subject: string;
  body: string;
  status: EmailStatus;
  senderEmail: string;
  senderName: string;
  scheduledAt: string;
  sentAt: string | null;
};

const DOC_SELECT = {
  id: true,
  userId: true,
  campaignId: true,
  to: true,
  subject: true,
  status: true,
  scheduledAt: true,
  sentAt: true,
  campaign: { select: { bodyText: true } },
  sender: { select: { email: true, name: true } },
} as const;

type DocRow = {
  id: string;
  userId: string;
  campaignId: string;
  to: string;
  subject: string;
  status: EmailStatus;
  scheduledAt: Date;
  sentAt: Date | null;
  campaign: { bodyText: string };
  sender: { email: string; name: string };
};

const toDoc = (row: DocRow): EmailDoc => ({
  userId: row.userId,
  campaignId: row.campaignId,
  to: row.to,
  subject: row.subject,
  body: row.campaign.bodyText.slice(0, MAX_INDEXED_BODY),
  status: row.status,
  senderEmail: row.sender.email,
  senderName: row.sender.name,
  scheduledAt: row.scheduledAt.toISOString(),
  sentAt: row.sentAt ? row.sentAt.toISOString() : null,
});

const INDEX_SETTINGS: estypes.IndicesIndexSettings = {
  analysis: {
    tokenizer: { email_parts: { type: "pattern", pattern: "[^\\p{L}\\p{N}]+" } },
    analyzer: { email_parts: { type: "custom", tokenizer: "email_parts", filter: ["lowercase"] } },
  },
};

const INDEX_MAPPINGS: estypes.MappingTypeMapping = {
  dynamic: "strict",
  properties: {
    userId: { type: "keyword" },
    campaignId: { type: "keyword" },
    to: { type: "text", analyzer: "email_parts", fields: { raw: { type: "keyword" } } },
    subject: { type: "text" },
    body: { type: "text" },
    status: { type: "keyword" },
    senderEmail: { type: "text", analyzer: "email_parts" },
    senderName: { type: "text" },
    scheduledAt: { type: "date" },
    sentAt: { type: "date" },
  },
};

export const ensureEmailIndex = async () => {
  const exists = await elastic.indices.exists({ index: EMAIL_INDEX });
  if (!exists) {
    await elastic.indices.create({ index: EMAIL_INDEX, settings: INDEX_SETTINGS, mappings: INDEX_MAPPINGS });
    console.log(`Elasticsearch index "${EMAIL_INDEX}" created`);
  }
};

const bulkIndex = async (rows: DocRow[]) => {
  for (let i = 0; i < rows.length; i += BULK_CHUNK) {
    const chunk = rows.slice(i, i + BULK_CHUNK);
    const operations = chunk.flatMap((row) => [{ index: { _index: EMAIL_INDEX, _id: row.id } }, toDoc(row)]);
    const result = await elastic.bulk({ operations });
    if (result.errors) {
      const first = result.items.find((item) => item.index?.error)?.index?.error;
      throw new Error(`Bulk index had errors: ${first?.reason ?? "unknown"}`);
    }
  }
};

const bestEffort = async (label: string, fn: () => Promise<void>) => {
  try {
    await fn();
  } catch (err) {
    console.warn(`Search indexing skipped (${label}):`, err instanceof Error ? err.message : err);
  }
};

export const indexCampaign = (campaignId: string) =>
  bestEffort(`campaign ${campaignId}`, async () => {
    const rows = await db.email.findMany({ where: { campaignId }, select: DOC_SELECT });
    await bulkIndex(rows);
  });

export const createSearchIndexer = (): EmailIndexer => ({
  index: (emailId) =>
    bestEffort(`email ${emailId}`, async () => {
      const row = await db.email.findUnique({ where: { id: emailId }, select: DOC_SELECT });
      if (!row) {
        await elastic.delete({ index: EMAIL_INDEX, id: emailId }, { ignore: [404] });
        return;
      }
      await elastic.index({ index: EMAIL_INDEX, id: row.id, document: toDoc(row) });
    }),
});

export const reindexAll = async () => {
  await ensureEmailIndex();
  let cursor: string | undefined;
  let total = 0;
  for (;;) {
    const rows = await db.email.findMany({
      select: DOC_SELECT,
      orderBy: { id: "asc" },
      take: BULK_CHUNK,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    await bulkIndex(rows);
    cursor = rows[rows.length - 1]!.id;
    total += rows.length;
  }
  await elastic.indices.refresh({ index: EMAIL_INDEX });
  return total;
};

export const searchEmailIds = async (userId: string, q: string, statuses: EmailStatus[], size: number) => {
  const result = await elastic.search({
    index: EMAIL_INDEX,
    size,
    _source: false,
    query: {
      bool: {
        must: {
          multi_match: {
            query: q,
            type: "bool_prefix",
            operator: "and",
            fields: ["subject^3", "to^2", "senderEmail", "senderName", "body"],
          },
        },
        filter: [{ term: { userId } }, { terms: { status: statuses } }],
      },
    },
  });
  return result.hits.hits.map((hit) => hit._id).filter((id): id is string => typeof id === "string");
};
