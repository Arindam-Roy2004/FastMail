import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export type AccessClaims = { sub: string };
export type RefreshClaims = { sub: string; ver: number };

const ACCESS_AUD = "access";
const REFRESH_AUD = "refresh";
const SLACK_STATE_AUD = "slack-oauth-state";

const readClaims = (decoded: string | JwtPayload): JwtPayload => {
  if (typeof decoded === "string" || typeof decoded.sub !== "string") {
    throw new jwt.JsonWebTokenError("Invalid token payload");
  }
  return decoded;
};

export const generateAccessToken = (userId: string) =>
  jwt.sign({}, env.JWT_ACCESS_SECRET, {
    subject: userId,
    audience: ACCESS_AUD,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
  });

export const verifyAccessToken = (token: string): AccessClaims => {
  const claims = readClaims(jwt.verify(token, env.JWT_ACCESS_SECRET, { audience: ACCESS_AUD }));
  return { sub: claims.sub as string };
};

export const generateRefreshToken = (userId: string, version: number) =>
  jwt.sign({ ver: version }, env.JWT_REFRESH_SECRET, {
    subject: userId,
    audience: REFRESH_AUD,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
  });

export const verifyRefreshToken = (token: string): RefreshClaims => {
  const claims = readClaims(jwt.verify(token, env.JWT_REFRESH_SECRET, { audience: REFRESH_AUD }));
  if (typeof claims.ver !== "number") throw new jwt.JsonWebTokenError("Invalid token payload");
  return { sub: claims.sub as string, ver: claims.ver };
};

export const generateSlackState = (userId: string) =>
  jwt.sign({}, env.JWT_ACCESS_SECRET, { subject: userId, audience: SLACK_STATE_AUD, expiresIn: "10m" });

export const verifySlackState = (state: string): string => {
  const claims = readClaims(jwt.verify(state, env.JWT_ACCESS_SECRET, { audience: SLACK_STATE_AUD }));
  return claims.sub as string;
};
