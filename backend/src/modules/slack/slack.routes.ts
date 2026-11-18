import { Router } from "express";
import { asyncHandler } from "../../common/middleware/async-handler.js";
import validate from "../../common/middleware/validate.middleware.js";
import { authenticate } from "../auth/auth.middleware.js";
import * as controller from "./slack.controller.js";
import { SlackCallbackDto } from "./dto/slack-callback.dto.js";

const router = Router();

router.get("/callback", validate({ query: SlackCallbackDto }), asyncHandler(controller.callback));

router.get("/", authenticate, asyncHandler(controller.status));
router.post("/connect", authenticate, asyncHandler(controller.connect));
router.post("/test", authenticate, asyncHandler(controller.test));
router.delete("/", authenticate, asyncHandler(controller.disconnect));

export default router;
