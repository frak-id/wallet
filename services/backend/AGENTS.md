# services/backend — Compass

Elysia.js API with DDD (12 domains + orchestration layer). Bun runtime. PostgreSQL (Drizzle) for most domains + libSQL/Turso for WebAuthn credentials. Packaged via `Dockerfile` (binary built with `bun build:binary` for Linux/ARM64). Bootstrapping (Drizzle migrations + RustFS bucket provisioning) lives in `services/bootstrap/` as a one-shot K8s Job.

## Quick Commands
```bash
bun run dev          # SST shell
bun run test         # backend-unit (Node env, sequential)
```
Drizzle migration commands (`db:generate`, `db:migrate`, `db:studio`, libSQL variants) live in `services/bootstrap/` — run them from there.

## Structure (only non-obvious parts)
```
src/
├── api/                 # BFF: user, business, external, common
├── orchestration/       # 14+ orchestrators (grouped in subfolders: identity/, reward/, interaction-submission/) — ONLY place for cross-domain logic
│   └── context.ts       # Orchestrator singletons (imports from domain contexts)
├── domain/{attribution, auth, campaign, campaign-bank, identity, media,
│           merchant, notifications, pairing, purchases, rewards, wallet}/
│   ├── db/schema.ts     # Drizzle schema (pgTable — except `auth` which uses sqliteTable for libSQL)
│   ├── repositories/    # Data access
│   ├── services/        # Pure business logic (no cross-domain imports)
│   ├── context.ts       # `{Domain}Context.{repositories,services}` singletons
│   └── index.ts         # Public exports
├── infrastructure/      # blockchain, persistence (postgres + libsql), messaging, integrations,
│                       # external, keys (KMS), dns, pricing, rateLimit, macro (Elysia middleware)
├── jobs/                # Background tasks
└── utils/
```

## Flow Rules
```
Simple:  api → service → repository
Complex: api → orchestrator → (services | repositories)

FORBIDDEN: service → service (cross-domain) · service → orchestrator · repository → service
```

## Constructor Pattern (DI)
```ts
// CORRECT — required readonly params
constructor(
  readonly repo: IdentityRepository,
  readonly rewardsHub: RewardsHubRepository,
) {}

// WRONG — nullable with default fallback
constructor(repo?: IdentityRepository) { this.repo = repo ?? new IdentityRepository(); }
```

## Non-Obvious Patterns
- **Use `{Domain}Context.services.*` everywhere** — never `new Service()` in API handlers.
- **Drizzle schemas live per-domain** (`src/domain/*/db/schema.ts`) — no central `schema.ts`. Not every domain has one (e.g. `wallet`, `campaign-bank`, `media` are DB-less).
- **DB Migration generation are always human generated** - Never generate or write drizzle migration, it will be done by the db team.
- **WebAuthn credentials live in libSQL/Turso** (`src/domain/auth/db/schema.ts` uses `sqliteTable`). Append-only, shared across environments. PostgreSQL backs every other domain. Migration config (`drizzle-libsql.config.ts`) lives in `services/bootstrap/`.
- **Macro pattern** = reusable Elysia middleware (auth, rate limit, CORS) in `src/infrastructure/macro/`.
- **Path aliases**: `@backend-utils`, `@backend-infrastructure/*`, `@backend-domain/*` (see tsconfig).
- **BFF split**: `src/api/{user,business,external,common}` — pick the right one by consumer, not by feature.
- **Blockchain via viem + permissionless + ox**; Pimlico/ZeroDev for ERC-4337 bundler/paymaster.
- **Merkle oracle** for purchase proofs. LRU cache for token metadata.
- **Error-as-body**: some endpoints return HTTP 200 with error payload inside body (legacy plugin integrations) — check the shape, not the status.
- **Media storage via Bun.s3** (`src/domain/media/repositories/MediaStorageRepository.ts`). Bucket provisioning is NOT runtime — handled by `services/bootstrap/`. Local dev requires running `bun -F @frak-labs/bootstrap start` once before `bun dev`.

## Anti-Patterns
`new Service()` in handlers · cross-domain service imports · service → orchestrator · nullable DI params · raw SQL (use Drizzle) · blocking ops in handlers · central `schema.ts`.

## See Also
Parent `/AGENTS.md` · `services/bootstrap/` (migrations + bucket bootstrap) · `infra/AGENTS.md` (bootstrap Job, GKE deploy) · `packages/client/` (Eden Treaty) · `packages/app-essentials/` (ABIs, addresses).
