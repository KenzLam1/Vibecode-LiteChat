import { beforeEach, describe, expect, it } from "vitest";

import { createDb, type Db } from "@/server/db";
import { loginSessions, users } from "@/server/db/schema";

import {
  AccountError,
  createAccountService,
  type AccountService,
} from "./service";

// Seam 2: the Account service, against a fresh in-memory database and a
// clock the tests control.

const DAY = 24 * 60 * 60 * 1000;
const START = new Date("2026-09-01T12:00:00Z");

let db: Db;
let clock: Date;
let accounts: AccountService;

beforeEach(() => {
  db = createDb(":memory:");
  clock = START;
  accounts = createAccountService({ db, now: () => clock });
});

function advance(ms: number) {
  clock = new Date(clock.getTime() + ms);
}

async function rejection(promise: Promise<unknown>): Promise<AccountError> {
  const error = await promise.then(
    () => {
      throw new Error("Expected the call to be rejected");
    },
    (error: unknown) => error,
  );
  expect(error).toBeInstanceOf(AccountError);
  return error as AccountError;
}

describe("sign up", () => {
  it("creates a user with a lowercased username", async () => {
    const user = await accounts.signUp("Kenzi", "correct horse");
    expect(user.username).toBe("kenzi");
  });

  it("rejects a username that differs only in case", async () => {
    await accounts.signUp("kenzi", "correct horse");
    const error = await rejection(accounts.signUp("KENZI", "another pass"));
    expect(error.reason).toBe("username-taken");
    expect(error.message).toMatch(/taken/i);
  });

  it("rejects passwords shorter than 8 characters", async () => {
    const error = await rejection(accounts.signUp("kenzi", "1234567"));
    expect(error.reason).toBe("password-too-short");
    await expect(accounts.signUp("kenzi", "12345678")).resolves.toBeTruthy();
  });

  it("rejects an empty or malformed username", async () => {
    for (const username of ["", "  ", "a", "has space", "x".repeat(33)]) {
      const error = await rejection(accounts.signUp(username, "long enough"));
      expect(error.reason).toBe("invalid-username");
    }
  });

  it("never stores the password itself", async () => {
    await accounts.signUp("kenzi", "correct horse");
    const row = db.select().from(users).get();
    expect(row?.passwordHash).not.toContain("correct horse");
    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
  });
});

describe("log in", () => {
  beforeEach(async () => {
    await accounts.signUp("kenzi", "correct horse");
  });

  it("returns a token for the right password, whatever the username's case", async () => {
    const { token, user } = await accounts.logIn("Kenzi", "correct horse");
    expect(token).toEqual(expect.any(String));
    expect(user.username).toBe("kenzi");
  });

  it("gives the same error for a wrong password and an unknown username", async () => {
    const wrongPassword = await rejection(
      accounts.logIn("kenzi", "wrong horse"),
    );
    const unknownUser = await rejection(
      accounts.logIn("nobody", "correct horse"),
    );
    expect(wrongPassword.reason).toBe("invalid-credentials");
    expect(unknownUser.reason).toBe(wrongPassword.reason);
    expect(unknownUser.message).toBe(wrongPassword.message);
  });

  it("can never log in as a user whose password hash is unusable", async () => {
    db.insert(users).values({ username: "demo", passwordHash: "!" }).run();
    const error = await rejection(accounts.logIn("demo", "!"));
    expect(error.reason).toBe("invalid-credentials");
  });
});

describe("login sessions", () => {
  let token: string;
  let userId: string;

  beforeEach(async () => {
    const user = await accounts.signUp("kenzi", "correct horse");
    userId = user.id;
    ({ token } = await accounts.logIn("kenzi", "correct horse"));
  });

  it("stores only a hash of the token", () => {
    const rows = db.select().from(loginSessions).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).not.toBe(token);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it("resolves a valid token to its user", async () => {
    await expect(accounts.resolve(token)).resolves.toEqual({
      id: userId,
      username: "kenzi",
    });
  });

  it("resolves an unknown token to none", async () => {
    await expect(accounts.resolve("not-a-real-token")).resolves.toBeNull();
    await expect(accounts.resolve("")).resolves.toBeNull();
  });

  it("resolves an expired token to none", async () => {
    advance(31 * DAY);
    await expect(accounts.resolve(token)).resolves.toBeNull();
    // Stays expired even if the clock were to go back.
    clock = START;
    await expect(accounts.resolve(token)).resolves.toBeNull();
  });

  it("extends the expiry when used near its end", async () => {
    advance(20 * DAY);
    await expect(accounts.resolve(token)).resolves.not.toBeNull();
    // Past the original 30 days, but within 30 days of the extension.
    advance(20 * DAY);
    await expect(accounts.resolve(token)).resolves.not.toBeNull();
  });

  it("doesn't extend the expiry when used early", async () => {
    advance(1 * DAY);
    await expect(accounts.resolve(token)).resolves.not.toBeNull();
    advance(30 * DAY);
    await expect(accounts.resolve(token)).resolves.toBeNull();
  });

  it("invalidates the token on logout", async () => {
    await accounts.logOut(token);
    await expect(accounts.resolve(token)).resolves.toBeNull();
  });

  it("logging out one browser leaves the other logged in", async () => {
    const other = await accounts.logIn("kenzi", "correct horse");
    await accounts.logOut(token);
    await expect(accounts.resolve(other.token)).resolves.not.toBeNull();
  });

  it("gives each login its own token", async () => {
    const other = await accounts.logIn("kenzi", "correct horse");
    expect(other.token).not.toBe(token);
  });
});
