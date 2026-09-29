# 11 — Accounts and login

**What to build:** Real users replace the seeded user. The Account service (the spec's second test seam) supports open sign-up with a unique, case-insensitive username and a password of at least 8 characters (argon2-hashed), login, login-session resolution, and logout, following ADR 0003 and the Lucia guide. Login sessions are stored hashed and extend while in use. `requireUser()` switches to reading the login session cookie. Logged-out visitors are redirected to login from pages and get 401 from API routes. Sign-up and login pages use LiteChat's centred-card style, and there's a logout control.

See spec: User Stories 1–12; ADR 0003; Implementation Decisions → Account service, Current-user seam; Testing Decisions → Seam 2.

**Blocked by:** 03 — Persisted conversations

**Status:** ready-for-agent

- [ ] Seam-2 tests: duplicate usernames rejected case-insensitively; passwords under 8 characters rejected; wrong password and unknown username return the same error; a valid token resolves to its user; expired and unknown tokens resolve to none; logout invalidates the token; expiry is extended when near its end
- [ ] Only a hash of the login session token is stored
- [ ] The cookie is HttpOnly and `SameSite=Lax`, and `Secure` outside localhost; writes check the request origin
- [ ] Logged-out page requests redirect to login; logged-out API requests return 401
- [ ] Two users in two browsers see only their own conversations; pasting one user's conversation URL into the other's browser gives not found
