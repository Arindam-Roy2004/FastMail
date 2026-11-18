import { Router } from "express";
import { IdParamDto } from "../../common/dto/id-param.dto.js";
import { asyncHandler } from "../../common/middleware/async-handler.js";
import validate from "../../common/middleware/validate.middleware.js";
import { authenticate } from "../auth/auth.middleware.js";
import * as controller from "./email.controller.js";
import { ListEmailsDto, SearchEmailsDto } from "./dto/list-emails.dto.js";
import { ScheduleEmailsDto } from "./dto/schedule-emails.dto.js";

const router = Router();

router.use(authenticate);
router.post("/schedule", validate({ body: ScheduleEmailsDto }), asyncHandler(controller.schedule));
router.get("/", validate({ query: ListEmailsDto }), asyncHandler(controller.list));
// Static paths before "/:id", or "counts" would be read as an id.
router.get("/counts", asyncHandler(controller.counts));
router.get("/search", validate({ query: SearchEmailsDto }), asyncHandler(controller.search));
router.get("/:id", validate({ params: IdParamDto }), asyncHandler(controller.getOne));

export default router;
