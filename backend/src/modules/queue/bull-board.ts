import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { getEmailQueue } from "./email.queue.js";

export const BULL_BOARD_PATH = "/admin/queues";

export const createBullBoardRouter = () => {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(BULL_BOARD_PATH);
  createBullBoard({
    queues: [new BullMQAdapter(getEmailQueue())],
    serverAdapter,
    options: { uiConfig: { boardTitle: "Email scheduler" } },
  });
  return serverAdapter.getRouter();
};
