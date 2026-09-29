# Hand-rolled username + password auth

Users sign up openly with a unique, case-insensitive username and a password (argon2-hashed); there is no email and no password reset. We hand-roll database-backed login sessions (random token stored hashed, HttpOnly `SameSite=Lax` `Secure` cookie, sliding expiry) following the Lucia guide at lucia-auth.com, instead of using an auth library. Better Auth's username plugin still requires an email at sign-up, which would mean storing fake addresses and carrying tables we don't use; the hand-rolled version is small enough to read in one sitting and debug under time pressure.

## Consequences

- Google SSO, if ever added, is our own work (e.g. the Arctic library), not a config switch.
- Open sign-up is safe only because the app runs locally. If it is ever deployed, gate sign-up behind an invite code first, or strangers can spend the course API keys.
