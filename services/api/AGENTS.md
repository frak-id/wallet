# services/api

Elysia.js API with domain-driven design. PostgreSQL (Drizzle) for Frak V2 hybrid loyalty engine.

## Reference

**Full architecture Document**: [ARCHITECTURE-V2.md](./ARCHITECTURE-V2.md)
**Legacy backend**: [../backend/](../backend/)

## Structure

```
services/
└── api/                      # V2 Backend (Elysia.js)
    ├── src/
    │   ├── core/             # Technical Foundation
    │   │   ├── errors/       # AppError, ErrorHandler
    │   │   ├── events/       # TypedEventEmitter (Internal Bus)
    │   │   ├── config.ts     # Env vars & Constants
    │   │   ├── logger.ts     # Structured Logger
    │   │   └── typebox/     # Custom TypeBox types
    │   │
    │   ├── domains/          # Business Logic (Bounded Contexts)
    │   │   ├── identity/     # Graph resolution, merging, repositories, services
    │   │   ├── attribution/  # Touchpoints, lookback, source priority, repositories, services
    │   │   ├── campaign/     # Rules engine, reward calculation, repositories, services
    │   │   ├── ledger/       # Asset logs, repositories, services
    │   │   ├── merchant/     # Config, webhooks, repositories, services
    │   │   └── analytics/    # OpenPanel proxy, event ingestion (Phase 2)
    │   │
    │   ├── infrastructure/   # External Adapters
    │   │   ├── blockchain/   # Viem client, Vault ABI
    │   │   ├── persistence/  # PostgreSQL (Drizzle), Schema definitions
    │   │   │   ├── schema/    # All DB schema files (identity.ts, merchant.ts, etc.)
    │   │   └── openpanel/    # Analytics wrapper
    │   │
    │   ├── interfaces/       # Entry Points
    │   │   ├── http/
    │   │   │   ├── guards/   # Auth middlewares (Webhook, SDK, User)
    │   │   │   └── routes/   # /track, /auth, /rewards, /merchants
    │   │   └── workers/      # Cron jobs (Chain sync, reward batching)
    │   │
    │   └── index.ts          # App entry
    │
    └── package.json
```

## Domain Boundaries

Each domain is a bounded context with:

- **identity**: Identity graph (groups, nodes, touchpoints), resolution, merging
- **attribution**: Attribution rules, touchpoint management, source priority
- **campaign**: Campaign rules, reward calculation, budget management
- **ledger**: Asset logs, reward status tracking, on-chain settlement
- **merchant**: Merchant configuration, webhooks, dashboard settings
- **analytics**: OpenPanel integration, event ingestion (Phase 2)

## Domain vs Schema Ownership

| Domain | Responsibility | Schema Location |
|---------|-------------|------------------|
| identity | Graph resolution, merging, repositories | `infrastructure/persistence/schema/identity.ts` |
| campaign | Rules, rewards, repositories | `infrastructure/persistence/schema/campaign.ts` |
| ledger | Asset tracking, repositories | `infrastructure/persistence/schema/ledger.ts` |
| merchant | Config, webhooks, repositories | `infrastructure/persistence/schema/merchant.ts` |

**Note**: Schemas are **infrastructure**, not domain logic. Domains contain repositories and services that use these schemas.

## Schema Organization

```
infrastructure/persistence/schema/
├── index.ts        # Re-exports all schemas
├── identity.ts      # identity_groups, identity_nodes, touchpoints
├── merchant.ts      # merchants
├── campaign.ts      # campaign_rules, attribution_rules
└── ledger.ts        # asset_logs, event_stream, asset_status enum
```

## Conventions

- **DDD**: Each domain isolated with own context, repositories, services
- **Repository pattern**: Abstract data access layer
- **Namespace instead of class**: Use exported namespace for logical component grouping
- **Schema separation**: Database schemas live in infrastructure, not domains
- **Split-brain events**: Operational → PostgreSQL, Analytical → OpenPanel (SDK-side routing)

## Anti-Patterns

- Cross-domain imports (use service layer)
- Direct SQL (use Drizzle queries)
- Blocking operations in handlers
- Mixing concerns across domains
- Defining schemas inside domain directories

## Database

- **PostgreSQL**: Drizzle ORM, schemas in `src/infrastructure/persistence/schema/`
- **Migrations**: `drizzle/{prod,dev}/` directories
- **Schema pattern**: One schema file per domain/aggregate (identity.ts, merchant.ts, etc.)

## Commands

```bash
# Development
bun run dev                    # Start dev server with watch mode
bun run build                  # Build for production

# Database
bun run db:generate            # Generate migrations from schema changes
bun run db:migrate             # Run migrations
bun run db:push               # Push schema changes (dev only)
bun run db:studio             # Open Drizzle Studio

# Code quality
bun run lint                 # Biome lint
bun run format:check          # Check formatting
bun run format                # Format code
bun run typecheck            # TypeScript check

# Testing
bun run test                 # Run all tests
bun run test:watch           # Watch mode
bun run test:coverage        # With coverage report
```

## Migration from Backend

When migrating patterns from legacy backend (`../backend`):

1. **Keep patterns**: Repository pattern, service layer, namespace exports
2. **Adapt patterns**:
   - Use Drizzle directly (no MongoDB)
   - Domain boundaries are stricter (no cross-domain imports)
   - Event-driven via TypedEventEmitter (internal bus)
3. **New patterns**:
   - Split-brain event routing (operational vs analytical)
   - JSON-based rules engine (flexible campaign/attribution rules)
   - Identity graph with anonymous fingerprint IDs
   - Separate merchant domain (config, webhooks)
   - **Schemas in infrastructure layer** (not in domains)

## Phase 1 Scope

- Identity Graph (anonymous fingerprint ID + merchant customer ID + wallet)
- P2P referral links (`?ref=0xWallet`)
- Fixed global rule per merchant
- Touchpoint tracking with 30-day lookback
- Webhook ingestion (Shopify, WooCommerce) - Phase 2
- Asset ledger with clearance periods
