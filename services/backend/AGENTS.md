# services/backend — Compass

Elysia.js API with DDD (12 domains + orchestration layer). Bun runtime. PostgreSQL (Drizzle) for most domains + libSQL/Turso for WebAuthn credentials. Packaged via `Dockerfile` (binary built with `bun build:binary` for Linux/ARM64); migrations via `MigrationDockerfile` as K8s Job.

## Quick Commands
```bash
bun run dev          # SST shell
bun run test         # backend-unit (Node env, sequential)
bun db:generate      # Generate Drizzle migration
bun db:migrate       # Apply Postgres migrations (local via SST context)
bun db:studio        # Drizzle Studio
bun db:generate:libsql  # Generate libSQL (auth) migration
bun db:migrate:libsql   # Apply libSQL migrations
```

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
- **WebAuthn credentials live in libSQL/Turso** (`src/domain/auth/db/schema.ts` uses `sqliteTable`, `drizzle-libsql.config.ts`). Append-only, shared across environments. PostgreSQL backs every other domain.
- **Macro pattern** = reusable Elysia middleware (auth, rate limit, CORS) in `src/infrastructure/macro/`.
- **Migrations deploy as `KubernetesJob`** BEFORE the backend `KubernetesService` — skipping this breaks the pod.
- **Path aliases**: `@backend-utils`, `@backend-infrastructure/*`, `@backend-domain/*` (see tsconfig).
- **BFF split**: `src/api/{user,business,external,common}` — pick the right one by consumer, not by feature.
- **Blockchain via viem + permissionless + ox**; Pimlico/ZeroDev for ERC-4337 bundler/paymaster.
- **Merkle oracle** for purchase proofs. LRU cache for token metadata.
- **Error-as-body**: some endpoints return HTTP 200 with error payload inside body (legacy plugin integrations) — check the shape, not the status.

## Anti-Patterns
`new Service()` in handlers · cross-domain service imports · service → orchestrator · nullable DI params · raw SQL (use Drizzle) · blocking ops in handlers · central `schema.ts`.

## See Also
Parent `/AGENTS.md` · `infra/AGENTS.md` (migration Job, GKE deploy) · `packages/client/` (Eden Treaty) · `packages/app-essentials/` (ABIs, addresses).
