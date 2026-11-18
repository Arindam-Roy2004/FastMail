import { Router } from "express";
import { asyncHandler } from "../../common/middleware/async-handler.js";
import validate from "../../common/middleware/validate.middleware.js";
import * as controller from "./auth.controller.js";
import { GoogleLoginDto } from "./dto/google-login.dto.js";
import { authenticate } from "./auth.middleware.js";

const router = Router();

router.post("/google", validate({ body: GoogleLoginDto }), asyncHandler(controller.google));
router.post("/refresh", asyncHandler(controller.refresh));
router.post("/logout", authenticate, asyncHandler(controller.logout));
router.get("/me", authenticate, asyncHandler(controller.getMe));

export default router;
