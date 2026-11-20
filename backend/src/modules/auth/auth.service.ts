import { OAuth2Client, type TokenPayload } from "google-auth-library";
import { db } from "../../common/config/db.js";
import { env, googleConfigured, isAdminEmail } from "../../common/config/env.js";
import ApiError from "../../common/utils/api-error.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../common/utils/jwt.utils.js";
import type { AuthUser } from "./auth.types.js";

const USER_SELECT = { id: true, name: true, email: true, avatar: true } as const;

export const toUserResponse = (user: AuthUser) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  // Lets the dashboard hide the queue dashboard link; the server still enforces it.
  isAdmin: isAdminEmail(user.email),
});

// Lazy so the API can boot before the Google client exists (routes answer 503).
let cachedClient: OAuth2Client | null = null;
const getClient = () => {
  if (!googleConfigured) throw ApiError.unavailable("Google sign-in is not configured on the server");
  if (!cachedClient) {
    cachedClient = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, "postmessage");
  }
  return cachedClient;
};

const exchangeCode = async (code: string): Promise<TokenPayload> => {
  const client = getClient();
  let idToken: string | null | undefined;
  try {
    const { tokens } = await client.getToken(code);
    idToken = tokens.id_token;
  } catch {
    throw ApiError.unauthorized("Google sign-in failed: the authorization code was rejected");
  }
  if (!idToken) throw ApiError.unauthorized("Google did not return an ID token");

  const ticket = await client
    .verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID! })
    .catch(() => {
      throw ApiError.unauthorized("Invalid Google credential");
    });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw ApiError.unauthorized("Invalid Google credential");
  // An unverified address could belong to someone else; never link on it.
  if (payload.email_verified === false) throw ApiError.unauthorized("Google email is not verified");
  return payload;
};

const issueTokens = (userId: string, tokenVersion: number) => ({
  accessToken: generateAccessToken(userId),
  refreshToken: generateRefreshToken(userId, tokenVersion),
});

export const loginWithGoogle = async (code: string) => {
  const payload = await exchangeCode(code);
  const email = payload.email!.toLowerCase();
  const name = (payload.name || payload.given_name || email.split("@")[0] || "User").slice(0, 100);
  const avatar = payload.picture ?? null;

  const existing = await db.user.findFirst({
    where: { OR: [{ googleId: payload.sub }, { email }] },
    select: { id: true },
  });

  const user = existing
    ? await db.user.update({
        where: { id: existing.id },
        data: { googleId: payload.sub, email, name, avatar },
        select: { ...USER_SELECT, tokenVersion: true },
      })
    : await db.user.create({
        data: { googleId: payload.sub, email, name, avatar },
        select: { ...USER_SELECT, tokenVersion: true },
      });

  return { user: toUserResponse(user), ...issueTokens(user.id, user.tokenVersion) };
};

export const refresh = async (token: string | undefined) => {
  if (!token) throw ApiError.unauthorized("No session");
  let claims;
  try {
    claims = verifyRefreshToken(token);
  } catch {
    throw ApiError.unauthorized("Session expired");
  }
  const user = await db.user.findUnique({
    where: { id: claims.sub },
    select: { ...USER_SELECT, tokenVersion: true },
  });
  if (!user || user.tokenVersion !== claims.ver) throw ApiError.unauthorized("Session expired");
  return { user: toUserResponse(user), ...issueTokens(user.id, user.tokenVersion) };
};

export const logout = async (userId: string) => {
  await db.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
};

export const getMe = async (userId: string) => {
  const user = await db.user.findUnique({ where: { id: userId }, select: USER_SELECT });
  if (!user) throw ApiError.unauthorized("User no longer exists");
  return toUserResponse(user);
};

export const userFromRefreshToken = async (token: string | undefined) => {
  if (!token) return null;
  try {
    const claims = verifyRefreshToken(token);
    const user = await db.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, email: true, tokenVersion: true },
    });
    return user && user.tokenVersion === claims.ver ? { id: user.id, email: user.email } : null;
  } catch {
    return null;
  }
};
