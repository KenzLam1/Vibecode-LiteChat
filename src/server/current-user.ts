import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "./db";
import { users } from "./db/schema";

export type CurrentUser = { id: string; username: string };

const SEEDED_USERNAME = "demo";
// Not a valid hash, so no password can ever log in as the seeded user.
const UNUSABLE_PASSWORD_HASH = "!";

// The only way routes get the current user. Until login exists it returns a
// seeded user; later it resolves the login session cookie instead.
export async function requireUser(): Promise<CurrentUser> {
  const db = getDb();
  const columns = { id: users.id, username: users.username };

  db.insert(users)
    .values({ username: SEEDED_USERNAME, passwordHash: UNUSABLE_PASSWORD_HASH })
    .onConflictDoNothing({ target: users.username })
    .run();

  const user = db
    .select(columns)
    .from(users)
    .where(eq(users.username, SEEDED_USERNAME))
    .get();
  if (!user) throw new Error("Seeded user is missing");
  return user;
}
