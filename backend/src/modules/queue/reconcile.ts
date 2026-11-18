import { db } from "../../common/config/db.js";
import { enqueueEmails, getEmailQueue, type QueueableEmail } from "./email.queue.js";

const PAGE = 1000;
const STATE_CHECKS_IN_PARALLEL = 100;

export const reconcile = async ({ lockMs }: { lockMs: number }) => {
  const started = Date.now();
  const reset = await db.email.updateMany({
    where: { status: "sending", claimedAt: { lt: new Date(started - lockMs) } },
    data: { status: "scheduled", claimedAt: null },
  });

  const queue = getEmailQueue();
  let checked = 0;
  let added = 0;
  let replaced = 0;
  let cursor: string | undefined;

  for (;;) {
    const rows = await db.email.findMany({
      where: { status: "scheduled" },
      select: { id: true, scheduledAt: true },
      orderBy: { id: "asc" },
      take: PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1]!.id;

    const toAdd: QueueableEmail[] = [];
    for (let i = 0; i < rows.length; i += STATE_CHECKS_IN_PARALLEL) {
      const batch = rows.slice(i, i + STATE_CHECKS_IN_PARALLEL);
      await Promise.all(
        batch.map(async (row) => {
          const state = await queue.getJobState(row.id);
          if (state === "unknown") {
            toAdd.push(row);
            added++;
          } else if (state === "completed" || state === "failed") {
            await (await queue.getJob(row.id))?.remove();
            toAdd.push(row);
            replaced++;
          }
        }),
      );
    }
    await enqueueEmails(toAdd);
    checked += rows.length;
  }

  console.log(
    `Reconcile: ${reset.count} abandoned send(s) reset, ${checked} scheduled checked, ` +
      `${added} re-queued, ${replaced} replaced (${Date.now() - started}ms)`,
  );
  return { reset: reset.count, checked, added, replaced };
};
