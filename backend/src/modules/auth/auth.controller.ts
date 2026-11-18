import type { CookieOptions, Request, Response } from "express";
import { isProd } from "../../common/config/env.js";
import { validated } from "../../common/middleware/validate.middleware.js";
import ApiResponse from "../../common/utils/api-response.js";
import * as authService from "./auth.service.js";
import type { GoogleLoginInput } from "./dto/google-login.dto.js";

export const REFRESH_COOKIE = "refreshToken";

const COOKIE_OPTS: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

const clearSession = (res: Response) => {
  res.clearCookie(REFRESH_COOKIE, { path: "/", sameSite: COOKIE_OPTS.sameSite, secure: COOKIE_OPTS.secure });
};

export const google = async (req: Request, res: Response) => {
  const { code } = validated<GoogleLoginInput>(req, "body");
  const { user, accessToken, refreshToken } = await authService.loginWithGoogle(code);
  res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTS);
  ApiResponse.ok(res, "Login successful", { user, accessToken });
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const { user, accessToken, refreshToken } = await authService.refresh(req.cookies?.[REFRESH_COOKIE]);
    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTS);
    ApiResponse.ok(res, "Token refreshed", { user, accessToken });
  } catch (err) {
    // A dead cookie must not be replayed on every page load.
    clearSession(res);
    throw err;
  }
};

export const logout = async (req: Request, res: Response) => {
  await authService.logout(req.user!.id);
  clearSession(res);
  ApiResponse.ok(res, "Logged out");
};

export const getMe = async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  ApiResponse.ok(res, "Profile", user);
};
