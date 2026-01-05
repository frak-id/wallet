# Frak V2 API

Hybrid Loyalty & Attribution Engine for Frak Wallet.

## Structure

```
src/
├── core/              # Technical Foundation (logger, errors, events, config, typebox)
├── domains/           # Business Logic (Bounded Contexts)
│   ├── identity/      # Identity Graph resolution and merging
│   ├── attribution/   # Touchpoints and attribution engine
│   ├── campaign/      # Rule engine and reward calculation
│   ├── ledger/        # Asset logs and reward tracking
│   ├── merchant/      # Config and dashboard settings
│   └── analytics/     # OpenPanel integration
├── infrastructure/     # External Adapters (DB, blockchain)
│   └── persistence/    # PostgreSQL (Drizzle), Schema definitions
│       └── schema/    # All DB schema files (identity.ts, merchant.ts, etc.)
└── interfaces/        # Entry Points (HTTP routes, workers)
```

## Schema Organization

Database schemas are organized by domain in `src/infrastructure/persistence/schema/`:

```
infrastructure/persistence/schema/
├── index.ts        # Re-exports all schemas
├── identity.ts      # identity_groups, identity_nodes, touchpoints
├── merchant.ts      # merchants
├── campaign.ts      # campaign_rules, attribution_rules
└── ledger.ts        # asset_logs, event_stream, asset_status enum
```

**Note**: Schemas are **infrastructure** code, not domain business logic. Domains contain repositories and services that use these schemas.

## Development

```bash
# Install dependencies
bun install

# Run in development
bun run dev

# Run tests
bun run test

# Database migrations
bun run db:generate
bun run db:migrate
bun run db:push

# Type checking
bun run typecheck

# Linting
bun run lint
bun run format
```

## Architecture

See [ARCHITECTURE-V2.md](./ARCHITECTURE-V2.md) for detailed architecture documentation.

### Key Concepts

- **Split-Brain Events**: Operational (PostgreSQL) vs Analytical (OpenPanel)
- **Identity Graph**: Merges anonymous IDs, merchant customer IDs, and wallets
- **Attribution Engine**: Touchpoint tracking with lookback windows
- **JSON Rules**: Flexible campaign and attribution rules
- **Hybrid Rewards**: Soft (PostgreSQL) + Hard (Blockchain settlement)

## Phase 1 Scope

- Identity Graph (anonymous fingerprint ID + merchant customer ID + wallet)
- P2P referral links (`?ref=0xWallet`)
- Fixed global rule per merchant
- Touchpoint tracking with 30-day lookback
- Webhook ingestion (Shopify, WooCommerce) - Phase 2
- Asset ledger with clearance periods
