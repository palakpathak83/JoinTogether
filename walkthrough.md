# Security Summary

**Reviewed Files**: 26
**Issues Resolved**: 1

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| CORS & Socket.IO Origin Handling | `server/app.ts` & `server/socket/index.ts` | 26 / 36 | Static origin allowlist omitted dynamic runtime host headers and allowed a broad dev fallback in Express while rejecting valid same-host origins on non-default ports in Socket.IO. | Medium | Fixed | Added a unified `corsOptionsDelegate` (`server/utils/cors.ts`) that verifies `Origin` against the request's `Host` / `X-Forwarded-Host` and configured `CLIENT_URL`/`APP_URL` origins without wildcard `*`. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Secrets & Key Boundaries | `server/config/env.ts` | Private credentials (`MONGODB_URI`, JWT signing keys, `ADMIN_BOOTSTRAP_PASSCODE`) remain strictly server-side in `process.env` with ephemeral `crypto.randomBytes(32)` fallbacks for JWT secrets when unset. |
| Password & Token Storage | `server/routes/auth.ts`, `server/utils/tokens.ts`, `src/lib/api.ts` | Passwords hashed with `bcryptjs`; short-lived 15m access JWT kept in React JS memory only (never `localStorage`/`sessionStorage`); rotating 7d refresh tokens stored SHA-256 hashed in MongoDB and delivered via `HttpOnly` cookies. |
| RBAC & Privilege Escalation | `server/middleware/auth.ts`, `server/routes/auth.ts`, `server/routes/admin.ts` | Self-registration hardcodes `role: 'USER'`; protected routes resolve user status and authoritative role from MongoDB; `ADMIN`/`SUPER_ADMIN` gates enforce route permissions; one-time `SUPER_ADMIN` bootstrap locks atomically once claimed. |
| Atomic Capacity & Ownership | `server/routes/groups.ts`, `server/routes/requests.ts`, `server/routes/matches.ts` | Request and match mutations verify resource ownership; group capacity enforcement uses atomic MongoDB `findOneAndUpdate` with `$expr: { $lt: [{ $size: '$members' }, '$maxCapacity'] }`. |
| Authenticated Socket.IO Rooms | `server/socket/index.ts` | Handshake middleware verifies access JWT and active user status in MongoDB; `group:join`, `message:send`, and `message:read` verify group membership in MongoDB before room access or persistence. |
| NoSQL Injection & XSS | `server/routes/*.ts`, `src/**` | All inputs validated via Zod schemas and `mongoose.isValidObjectId` checks; regex searches escape metacharacters; React JSX bindings prevent unsafe HTML rendering. |
| Dependency Audit | `bun.lock` | Read-only `bun audit` found 0 production runtime vulnerabilities and 2 moderate dev-only advisories in `jest`/`ts-jest` transitive `glob`/`minimatch` packages (not shipped in runtime bundle). |

## PoC Verification

### Cross-Origin Policy on Express & Socket.IO Handshakes

#### Summary
| Field | Value |
|---|---|
| Issue Type | Origin Validation Mismatch |
| Impact | Medium |
| Affected File | `server/utils/cors.ts:4` |
| Test Scenario | `Origin: https://untrusted-attacker.example` sent with `Host: localhost:3000` |

#### How It Was Fixed
Centralized origin validation in `corsOptionsDelegate` (`server/utils/cors.ts`), checking that any supplied `Origin` matches either the verified request `Host` / `X-Forwarded-Host` header or an explicit entry from `CLIENT_URL` / `APP_URL`, never emitting `Access-Control-Allow-Origin: *` alongside credentials.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Request with `Origin: https://untrusted-attacker.example` arrives at Express or Socket.IO | Enters `corsOptionsDelegate` (`server/utils/cors.ts:4`) |
| 2 | `originUrl.host` (`untrusted-attacker.example`) fails `isSameHost` check against `Host` (`localhost:3000`) and is absent from `getAllowedOrigins()` | Validation fails |
| 3 | Callback invokes `callback(new Error('Not allowed by CORS'))` | **Handled Safely** (`403` JSON error / Socket rejected) |

#### Conclusion
**Fix Verified** - Untrusted cross-origin requests are rejected while same-host and explicitly configured frontend origins connect reliably with credentials.
