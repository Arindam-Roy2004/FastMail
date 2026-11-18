import type { AuthUser } from "../modules/auth/auth.types.js";

// Declaration merging needs `interface` here; everywhere else the code uses `type`.
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

export {};
