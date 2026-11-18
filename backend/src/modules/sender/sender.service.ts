import nodemailer from "nodemailer";
import { db } from "../../common/config/db.js";
import ApiError from "../../common/utils/api-error.js";
import type { CreateSenderInput } from "./dto/create-sender.dto.js";
import { ETHEREAL_HOST } from "./dto/create-sender.dto.js";

// Never select smtpUser/smtpPass for a response.
const SENDER_SELECT = { id: true, name: true, email: true, smtpHost: true, createdAt: true } as const;

type SenderRow = { id: string; name: string; email: string; smtpHost: string; createdAt: Date };

export const toSenderResponse = (sender: SenderRow) => ({
  id: sender.id,
  name: sender.name,
  email: sender.email,
  provider: sender.smtpHost === ETHEREAL_HOST ? "ethereal" : "smtp",
  createdAt: sender.createdAt.toISOString(),
});

export const listSenders = async (userId: string) => {
  const senders = await db.sender.findMany({
    where: { userId },
    select: SENDER_SELECT,
    orderBy: { createdAt: "asc" },
  });
  return senders.map(toSenderResponse);
};

const createEtherealAccount = async () => {
  process.env.ETHEREAL_CACHE = "no";
  try {
    return await nodemailer.createTestAccount();
  } catch {
    // Ethereal's account API is a third party; say so rather than a bare 500.
    throw ApiError.unavailable("Could not reach Ethereal to create a test inbox. Try again in a moment.");
  }
};

export const createSender = async (userId: string, input: CreateSenderInput) => {
  const count = await db.sender.count({ where: { userId } });
  const fallbackName = `Sender ${count + 1}`;

  const data =
    input.mode === "ethereal"
      ? await createEtherealAccount().then((account) => ({
          name: input.name ?? fallbackName,
          email: account.user,
          smtpHost: account.smtp.host,
          smtpPort: account.smtp.port,
          smtpUser: account.user,
          smtpPass: account.pass,
        }))
      : {
          name: input.name,
          email: input.email,
          smtpHost: input.smtpHost,
          smtpPort: input.smtpPort,
          smtpUser: input.smtpUser,
          smtpPass: input.smtpPass,
        };

  const sender = await db.sender.create({ data: { ...data, userId }, select: SENDER_SELECT });
  return toSenderResponse(sender);
};

export const deleteSender = async (userId: string, senderId: string) => {
  const sender = await db.sender.findFirst({ where: { id: senderId, userId }, select: { id: true } });
  if (!sender) throw ApiError.notfound("Sender not found");
  const pending = await db.email.count({
    where: { senderId, status: { in: ["scheduled", "sending"] } },
  });
  if (pending > 0) {
    throw ApiError.conflict(`This sender still has ${pending} email(s) waiting to send`);
  }
  // Sent history keeps a foreign key to the sender, so it is kept, not cascaded.
  const history = await db.email.count({ where: { senderId } });
  if (history > 0) throw ApiError.conflict("This sender has sent emails and is kept for history");
  await db.sender.delete({ where: { id: senderId } });
};

export const assertOwnedSenders = async (userId: string, senderIds: string[]) => {
  const owned = await db.sender.count({ where: { userId, id: { in: senderIds } } });
  if (owned !== senderIds.length) throw ApiError.forbidden("One or more senders do not belong to you");
};
