# 11 — Accounts and login

**What to build:** Real users replace the seeded user. The Account service (the spec's second test seam) supports open sign-up with a unique, case-insensitive username and a password of at least 8 characters (argon2-hashed), login, login-session resolution, and logout, following ADR 0003 and the Lucia guide. Login sessions are stored hashed and extend while in use. `requireUser()` switches to reading the login session cookie. Logged-out visitors are redirected to login from pages and get 401 from API routes. Sign-up and login pages use LiteChat's centred-card style, and there's a logout control.

See spec: User Stories 1–12; ADR 0003; Implementation Decisions → Account service, Current-user seam; Testing Decisions → Seam 2.

**Blocked by:** 03 — Persisted conversations

**Status:** implemented

- [x] Seam-2 tests: duplicate usernames rejected case-insensitively; passwords under 8 characters rejected; wrong password and unknown username return the same error; a valid token resolves to its user; expired and unknown tokens resolve to none; logout invalidates the token; expiry is extended when near its end
- [x] Only a hash of the login session token is stored
- [x] The cookie is HttpOnly and `SameSite=Lax`, and `Secure` outside localhost; writes check the request origin
- [x] Logged-out page requests redirect to login; logged-out API requests return 401
- [x] Two users in two browsers see only their own conversations; pasting one user's conversation URL into the other's browser gives not found

## Comments

**2026-09-29 — implemented.** Findings:

- **Service shape.** `createAccountService({ db, now? })` in `src/server/accounts/service.ts` returns `signUp`, `logIn` (→ `{ token, user, expiresAt }`), `resolve` (→ user or `null`) and `logOut`. Rejections throw `AccountError` with a `reason` and a message that is safe to show. `src/server/accounts/index.ts` binds it to the real database and holds the cookie read/write helpers. Seam-2 tests live in `account-service.test.ts` and import `service.ts` directly, as seam 1 does.
- **Rules.** Usernames are trimmed and lowercased, then must be 3–32 characters of letters, numbers, `.`, `-` and `_` (the spec set no rule, and an empty or 10 kB username had to be refused somewhere). Passwords are 8–256 characters, counted in code points; the cap bounds hashing work. Duplicate sign-up is checked up front and again via the unique constraint, for the race while argon2 runs.
- **Same error, similar timing.** An unknown username is still verified against a dummy argon2 hash, so it takes about as long to reject as a wrong password. A stored hash that isn't valid argon2 (the old seeded `demo` user's `!`) makes `verify` throw, which is caught and treated as a wrong password.
- **Login sessions.** Tokens are 32 random bytes (base64url); the `login_sessions.id` is their SHA-256 hex. Sessions last 30 days and are pushed back to 30 days when resolved within 15 days of expiry (Lucia's numbers). An expired row is deleted when it's next resolved; nothing sweeps old rows.
- **Next 16 uses `proxy.ts`, not `middleware.ts`.** `src/proxy.ts` (Node runtime by default) does three cookie-only things: refuses any non-GET/HEAD/OPTIONS request whose `Origin` host doesn't match `Host` (403), sends logged-out GETs of any page but `/login` and `/signup` to `/login` and answers `/api/*` with 401 when there's no cookie at all, and re-sets the cookie on GETs so its `Max-Age` keeps pace with the database's sliding expiry (a Server Component can't set cookies). It never touches the database. The real check is `requireUser()`/`currentUser()`; the proxy's redirect and 401 are a backstop for routes added later that forget to call them.
- **Current-user seam.** `requireUser()` (pages and Server Functions) redirects to `/login`; `currentUser()` returns the user or `null` and is what Route Handlers use, answering 401 themselves. `currentUser` is wrapped in React `cache`, so the layout and the page resolve the cookie once per request. The seeded `demo` user is no longer created; in an existing database it and its conversations are simply unreachable.
- **Cookie.** `litechat_login_session`, `Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age` 30 days, and `Secure` unless the request's host is `localhost`, `*.localhost`, `127.0.0.1` or `[::1]` (checked by sending `Host: litechat.example`). Login, sign-up and logout are Server Actions, which Next also origin-checks.
- **Logout control.** `src/app/components/logout-control.tsx`, a Server Component mounted from `src/app/layout.tsx`. The conversation sidebar now contains the username, Profile link and Log out button; it renders nothing when logged out.
- **Seen in the real app** (port 3003): a wrong login shows "Incorrect username or password."; sign-up logs straight in and the layout picks up the new user; a second user (created through the Account service, with requests sent by curl carrying their cookie) gets 404 for the first user's `/c/<id>` page and "Conversation not found." from `/api/chat`, and the first user's browser gets the 404 page for the second user's conversation. Logging out and revisiting a conversation lands on `/login`; logging back in with the username in capitals works; a chat reply still streams through the proxy's origin check.
- **Not done / for later.** No rate limiting on login or sign-up, and sign-up reveals whether a username is taken (unavoidable with open sign-up). Both are acceptable only while the app stays local (ADR 0003). No schema change was needed.
