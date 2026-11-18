import { Router } from "express";
import { IdParamDto } from "../../common/dto/id-param.dto.js";
import { asyncHandler } from "../../common/middleware/async-handler.js";
import validate from "../../common/middleware/validate.middleware.js";
import { authenticate } from "../auth/auth.middleware.js";
import * as controller from "./sender.controller.js";
import { CreateSenderDto } from "./dto/create-sender.dto.js";

const router = Router();

router.use(authenticate);
router.get("/", asyncHandler(controller.list));
router.post("/", validate({ body: CreateSenderDto }), asyncHandler(controller.create));
router.delete("/:id", validate({ params: IdParamDto }), asyncHandler(controller.remove));

export default router;
