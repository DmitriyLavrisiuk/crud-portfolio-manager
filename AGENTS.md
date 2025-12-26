# AGENTS.md — Instructions for Codex (VS Code Extension)
> These rules are binding for this repository. Follow them unless the user explicitly overrides.

## 0) Primary goals
1. **Security-first** (no secret leaks, safe defaults).
2. **Versioned, incremental development** (v0.1.0, v0.2.0, …).
3. **Clean, reviewable diffs** (minimal change, easy code review).

---

## 1) Output format (MANDATORY)
- **Default:** return **(a)** a list of changed files and **(b)** a **diff/patch** for all changes.
- **Do NOT** print full file contents by default.
- Provide **full file content only when**:
  - the file is **new and small** (≤ 100 lines), OR
  - the user explicitly asks: “send full file”, “full-file output”, “paste entire file”.

In every response, include:
- **Changed files:** bullet list
- **How to run/check:** exact commands
- **Notes:** any assumptions or tradeoffs

---

## 2) Work by versions & commits
- Work in **small versions**: v0.1.0, v0.2.0, …
- Each version must have a clear **Definition of Done** in the task prompt or described before coding.
- Prefer **1 logical change = 1 commit**.
- Do not combine refactors with feature work unless requested.

### Commit conventions (Conventional Commits)
Allowed prefixes:
- `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`, `build:`

Examples:
- `chore: bootstrap monorepo scaffold (v0.1.0)`
- `feat(auth): add jwt access/refresh (v0.2.0)`
- `fix(api): validate env on startup`

Branch naming:
- `feat/<scope>-<short-desc>`
- `fix/<scope>-<short-desc>`
- `chore/<scope>-<short-desc>`

Tagging:
- Tag releases as `vX.Y.Z` after each version is complete.

---

## 3) Repository layout (MANDATORY)
Monorepo layout:
- `apps/web` — Vite + React + TypeScript SPA
- `apps/api` — NestJS + TypeScript API
- `packages/shared` — shared types/schemas (Zod later)

Preferred package manager:
- **pnpm workspaces** (unless user explicitly requests otherwise)

---

## 4) Tech stack decisions (DEFAULTS)
### Web (apps/web)
- Vite + React + TypeScript
- React Router (History API)
- TailwindCSS
- shadcn/ui (Radix-based components)
- TanStack Query/Table will be introduced later when requested
- Forms: React Hook Form + Zod will be introduced later when requested

### API (apps/api)
- NestJS + TypeScript
- MongoDB via Mongoose
- Auth later: JWT access/refresh

---

## 5) MCP & documentation usage (AUTO-RULES)
These rules exist to keep configs and component usage aligned with official docs.

### 5.1 Context7 (primary source of truth for library docs)
- When you need **setup steps, configuration, or API usage** for any library/framework used in this repo,
  **ALWAYS consult the Context7 MCP server first** and follow its guidance.
- Use Context7 especially for:
  - TailwindCSS installation/config (Vite/React/TS)
  - React Router patterns
  - NestJS + Mongoose patterns
  - TanStack Query/Table usage (when introduced)
  - Zod / React Hook Form usage (when introduced)
- If Context7 output conflicts with local code constraints, choose the **minimal safe change** and note the discrepancy.

### 5.2 shadcn MCP (source of truth for shadcn/ui)
- For any shadcn/ui component additions/changes:
  - Use the **shadcn MCP tools** to discover/install components and follow the registry defaults.
  - Prefer shadcn/ui canonical structure (e.g., components in `apps/web/src/components/ui`).
- Do not hand-roll shadcn/ui components if the MCP/registry provides them.
- Keep styling minimal; do not redesign UI unless explicitly requested.

### 5.3 Doc usage boundaries
- Do not use web search unless explicitly requested by the user.
- If MCP tools are unavailable at runtime, proceed with best-effort defaults and clearly state assumptions.

---

## 6) Security rules (NON-NEGOTIABLE)
### Secrets & keys
- **Never** commit secrets (API keys, tokens, private keys, passwords).
- Use `.env.example` files only; real `.env` must be in `.gitignore`.
- **Never** expose Binance API keys to the frontend.
- Do not print secrets in logs, errors, or responses.

### Passwords & tokens (when implemented)
- Password hashing: **argon2id** (preferred).
- JWT:
  - short-lived **access token**
  - **refresh token in HttpOnly cookie**
  - store **hash** of refresh token in DB (never store raw refresh token)
- Rate limiting, Helmet, strict CORS will be added in hardening versions.

### Encryption at rest (MongoDB fields)
- Encrypt sensitive fields at the **application layer** using **AES-256-GCM**.
- Encryption key (`MASTER_KEY`) must come from environment variables only.
- Store `ciphertext`, `iv`, `authTag`, and `keyVersion` in DB.
- Plan for key rotation via `keyVersion`.

### Request/response safety
- Validate inputs server-side.
- Avoid exposing internal stack traces to clients in production modes.
- Prefer allowlists over denylists for CORS and env exposure.

---

## 7) “Spot-only” trading constraints (for later versions)
- In Binance **Spot**, there is no true “short” without margin/futures.
- “Reverse” operations must not sell more than available balance.
- Editing executed orders is not possible; “edit” means **cancel + replace** for open orders.

---

## 8) Coding standards
### TypeScript
- Prefer strict typing; avoid `any`.
- Export types when useful; keep DTOs explicit.
- Do not introduce global hacks or unstable patterns.

### Error handling
- Provide clear, user-safe error messages.
- Use consistent error shapes for API responses.

### Dependencies
- Do not add dependencies without need.
- If adding a dependency, explain why and what alternatives were considered.

### Lint/format
- Keep ESLint + Prettier passing.
- Keep changes formatted; avoid whitespace-only diffs unless necessary.

---

## 9) Testing (phased)
- v0.1.0 may have no tests.
- For auth/trading/statistics: add unit tests for core services and integration tests for critical flows when requested.
- Avoid flaky tests; prefer deterministic mocks.

---

## 10) Documentation requirements
When you introduce a new capability:
- Update `README.md` with:
  - how to run
  - env vars needed
  - common troubleshooting steps
- Keep `.env.example` up to date.

---

## 11) Do not change without explicit request
- Public API contracts once introduced (unless a new version requires breaking changes).
- Linting/formatting rules
- Project folder structure

---

## 12) Default ports (unless overridden)
- Web: `5173`
- API: `4000`
- Mongo: `27017`

---

## 13) If something is ambiguous
- Make the safest assumption.
- Keep the change minimal.
- Document the assumption in the response notes.
