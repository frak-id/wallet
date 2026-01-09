# services/backend

Elysia.js API with domain-driven design. PostgreSQL (Drizzle) + MongoDB.

## Structure

```
src/
├── api/              # API route composition (BFF pattern)
├── orchestration/    # Cross-domain coordination layer
│   ├── context.ts    # Singleton orchestrator instances
│   ├── PurchaseLinkingOrchestrator.ts
│   ├── PurchaseWebhookOrchestrator.ts
│   └── RewardOrchestrator.ts
├── domain/           # DDD bounded contexts
│   ├── attribution/  # Touchpoint tracking, conversion attribution
│   ├── auth/         # WebAuthn authentication
│   ├── business/     # Business operations
│   ├── campaign/     # Campaign rules, reward calculation
│   ├── identity/     # Identity resolution, group management
│   ├── notifications/ # Push notifications
│   ├── oracle/       # Blockchain oracle
│   ├── pairing/      # Device pairing
│   ├── purchases/    # Purchase tracking, webhooks
│   ├── referral/     # Referral links, chains
│   ├── rewards/      # Asset logs, settlements
│   └── wallet/       # Wallet operations
├── infrastructure/   # DB, external services
├── jobs/             # Background jobs
└── utils/            # Shared utilities
```

## Architecture: Orchestration Layer

Cross-domain coordination uses an **orchestration layer** to avoid coupling between domain services.

### Flow Rules

```
Simple flow:  api → service → repository
Complex flow: api → orchestrator → services/repositories

FORBIDDEN:
- service → orchestrator (services must stay pure)
- repository → service
```

### Domain Context Pattern

Each domain exposes a `context.ts` that builds singletons bottom-up:

```typescript
// domain/referral/context.ts
const referralLinkRepository = new ReferralLinkRepository();
const referralService = new ReferralService(referralLinkRepository);

export namespace ReferralContext {
    export const repositories = { referralLink: referralLinkRepository };
    export const services = { referral: referralService };
}
```

### Orchestration Context

Orchestrators are instantiated in `orchestration/context.ts`, importing from domain contexts:

```typescript
// orchestration/context.ts
import { IdentityContext } from "../domain/identity/context";
import { RewardsContext } from "../domain/rewards/context";

const rewardOrchestrator = new RewardOrchestrator(
    RewardsContext.repositories.interactionLog,
    RewardsContext.repositories.assetLog,
    // ... other dependencies from domain contexts
);

export namespace OrchestrationContext {
    export const orchestrators = { reward: rewardOrchestrator };
}
```

### Constructor Pattern

Use **required readonly params** (never nullable with defaults):

```typescript
// CORRECT
constructor(
    readonly repository: IdentityRepository,
    readonly rewardsHub: RewardsHubRepository
) {}

// WRONG - anti-pattern
constructor(repository?: IdentityRepository) {
    this.repository = repository ?? new IdentityRepository();
}
```

## Where to Look

| Task | Location |
|------|----------|
| Add domain | `src/domain/{name}/` |
| Cross-domain logic | `src/orchestration/` |
| Domain singletons | `src/domain/{name}/context.ts` |
| DB schemas | `src/domain/*/db/schema.ts` |
| API routes | `src/api/` |
| Background jobs | `src/jobs/` |
| DB connection | `src/infrastructure/persistence/` |
| Shared utilities | `src/utils/` |

## Domain Pattern

```
domain/
└── auth/
    ├── api/          # Elysia routes (optional, can be in src/api/)
    ├── db/           # Drizzle schema
    ├── repositories/ # Data access
    ├── services/     # Business logic (pure, no cross-domain deps)
    ├── context.ts    # Singleton exports
    └── index.ts      # Public exports
```

## Commands

```bash
bun run dev          # Development (SST shell)
bun run test         # Unit tests (backend-unit project)
bun run test:watch   # Watch mode
bun db:studio        # Drizzle Studio
bun db:generate      # Generate migrations
bun db:migrate       # Run migrations
```

## Conventions

- **DDD**: Each domain isolated with own context
- **Repository pattern**: Abstract data access
- **Orchestration pattern**: Cross-domain coordination in `src/orchestration/`
- **Context pattern**: Domain singletons via `{Domain}Context` namespace
- **Macro pattern**: Reusable Elysia middleware
- **Drizzle schemas**: `src/domain/*/db/schema.ts`

## Anti-Patterns

| Forbidden | Do Instead |
|-----------|------------|
| Cross-domain service imports | Use orchestration layer |
| Service importing orchestrator | Move logic to orchestrator |
| `new Service()` in API handlers | Use `{Domain}Context.services.*` |
| Nullable constructor params | Required readonly params with DI |
| Direct SQL | Use Drizzle queries |
| Blocking operations in handlers | Use async/await |

## Database

- **PostgreSQL**: Drizzle ORM, domain-specific schemas
- **MongoDB**: Authenticator credentials storage
- **Migrations**: `drizzle/{prod,dev}/` directories

## Testing

- Vitest with Node environment
- Sequential execution (stateful mocks)
- Mocks: `test/mock/` (viem, drizzle, webauthn, bun)

## Notes

- WebAuthn via ox/WebAuthnP256
- Merkle tree oracle for purchase proofs
- LRU caching for token metadata
- BFF (Backend for Frontend) API organization in `src/api/`
