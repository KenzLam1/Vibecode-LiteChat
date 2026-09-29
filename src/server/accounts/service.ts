import { createHash, randomBytes } from "node:crypto";

import { hash, verify } from "@node-rs/argon2";
import { eq } from "drizzle-orm";

import type { Db } from "@/server/db";
import { loginSessions, users } from "@/server/db/schema";

// The Account service: open sign-up, login, login-session resolution and
// logout, hand-rolled per ADR 0003 and the Lucia guide (lucia-auth.com).

export type User = { id: string; username: string };

export type LoginSession = { token: string; user: User; expiresAt: Date };

export type AccountErrorReason =
  | "invalid-username"
  | "username-taken"
  | "password-too-short"
  | "password-too-long"
  | "invalid-credentials";

// A rejection whose message is safe to show the user.
export class AccountError extends Error {
  constructor(
    readonly reason: AccountErrorReason,
    message: string,
  ) {
    super(message);
    this.name = "AccountError";
  }
}

export const PASSWORD_MIN_CHARS = 8;
// Caps the hashing work one request can ask for.
export const PASSWORD_MAX_CHARS = 256;
const USERNAME_PATTERN = /^[a-z0-9_.-]{3,32}$/;

const DAY_MS = 24 * 60 * 60 * 1000;
export const LOGIN_SESSION_DAYS = 30;
const LOGIN_SESSION_MS = LOGIN_SESSION_DAYS * DAY_MS;
// A login session used within this long of its expiry is extended.
const EXTEND_WITHIN_MS = 15 * DAY_MS;

const INVALID_CREDENTIALS = "Incorrect username or password.";

export type AccountService = {
  signUp(username: string, password: string): Promise<User>;
  logIn(username: string, password: string): Promise<LoginSession>;
  // The user a login session token belongs to, or null if the token is
  // unknown or expired. Extends the expiry when it's near its end.
  resolve(token: string): Promise<User | null>;
  logOut(token: string): Promise<void>;
};

export function createAccountService({
  db,
  now = () => new Date(),
}: {
  db: Db;
  now?: () => Date;
}): AccountService {
  // Verified against when the username is unknown, so that an unknown
  // username takes as long to reject as a wrong password.
  let dummyHash: Promise<string> | undefined;

  function normaliseUsername(username: string) {
    return username.trim().toLowerCase();
  }

  async function passwordMatches(storedHash: string, password: string) {
    try {
      return await verify(storedHash, password);
    } catch {
      // An unusable stored hash (e.g. "!") never matches.
      return false;
    }
  }

  return {
    async signUp(rawUsername, password) {
      const username = normaliseUsername(rawUsername);
      if (!USERNAME_PATTERN.test(username)) {
        throw new AccountError(
          "invalid-username",
          "Usernames are 3–32 characters: letters, numbers, dots, dashes and underscores.",
        );
      }
      const length = Array.from(password).length;
      if (length < PASSWORD_MIN_CHARS) {
        throw new AccountError(
          "password-too-short",
          `Passwords must be at least ${PASSWORD_MIN_CHARS} characters.`,
        );
      }
      if (length > PASSWORD_MAX_CHARS) {
        throw new AccountError(
          "password-too-long",
          `Passwords can be at most ${PASSWORD_MAX_CHARS} characters.`,
        );
      }

      const taken = () =>
        new AccountError("username-taken", "That username is already taken.");
      const existing = db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .get();
      if (existing) throw taken();

      const passwordHash = await hash(password);
      try {
        return db
          .insert(users)
          .values({ username, passwordHash })
          .returning({ id: users.id, username: users.username })
          .get();
      } catch (error) {
        // Someone else took the name while the password was hashing.
        if (isUniqueViolation(error)) throw taken();
        throw error;
      }
    },

    async logIn(rawUsername, password) {
      const username = normaliseUsername(rawUsername);
      const user = db
        .select({
          id: users.id,
          username: users.username,
          passwordHash: users.passwordHash,
        })
        .from(users)
        .where(eq(users.username, username))
        .get();

      if (!user) {
        dummyHash ??= hash("not the password of anyone");
        await passwordMatches(await dummyHash, password);
        throw new AccountError("invalid-credentials", INVALID_CREDENTIALS);
      }
      if (
        Array.from(password).length > PASSWORD_MAX_CHARS ||
        !(await passwordMatches(user.passwordHash, password))
      ) {
        throw new AccountError("invalid-credentials", INVALID_CREDENTIALS);
      }

      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(now().getTime() + LOGIN_SESSION_MS);
      db.insert(loginSessions)
        .values({ id: hashToken(token), userId: user.id, expiresAt })
        .run();
      return { token, user: { id: user.id, username: user.username }, expiresAt };
    },

    async resolve(token) {
      if (!token) return null;
      const id = hashToken(token);
      const row = db
        .select({
          id: users.id,
          username: users.username,
          expiresAt: loginSessions.expiresAt,
        })
        .from(loginSessions)
        .innerJoin(users, eq(users.id, loginSessions.userId))
        .where(eq(loginSessions.id, id))
        .get();
      if (!row) return null;

      const at = now().getTime();
      if (at >= row.expiresAt.getTime()) {
        db.delete(loginSessions).where(eq(loginSessions.id, id)).run();
        return null;
      }
      if (at >= row.expiresAt.getTime() - EXTEND_WITHIN_MS) {
        db.update(loginSessions)
          .set({ expiresAt: new Date(at + LOGIN_SESSION_MS) })
          .where(eq(loginSessions.id, id))
          .run();
      }
      return { id: row.id, username: row.username };
    },

    async logOut(token) {
      if (!token) return;
      db.delete(loginSessions)
        .where(eq(loginSessions.id, hashToken(token)))
        .run();
    },
  };
}

// Only this hash is stored, so a leaked database can't be replayed as cookies.
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isUniqueViolation(error: unknown) {
  let cause: unknown = error;
  while (cause instanceof Error) {
    if ((cause as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
      return true;
    }
    cause = cause.cause;
  }
  return false;
}
