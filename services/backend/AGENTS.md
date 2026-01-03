# services/backend

Elysia.js API with domain-driven design. PostgreSQL (Drizzle) + MongoDB.

## Structure

```
src/
├── api/              # API route composition
├── domain/           # DDD bounded contexts
│   ├── auth/         # WebAuthn authentication
│   ├── business/     # Business operations
│   ├── interactions/ # Interaction tracking
│   ├── notifications/ # Push notifications
│   ├── oracle/       # Blockchain oracle
│   ├── pairing/      # Device pairing
│   └── wallet/       # Wallet operations
├── infrastructure/   # DB, external services
├── jobs/             # Background jobs
└── utils/            # Shared utilities
```

## Where to Look

| Task | Location |
|------|----------|
| Add domain | `src/domain/{name}/` |
| DB schemas | `src/domain/*/db/schema.ts` |
| API routes | `src/api/` |
| Background jobs | `src/jobs/` |
| DB connection | `src/infrastructure/persistence/` |

## Domain Pattern

```
domain/
└── auth/
    ├── api/          # Elysia routes
    ├── db/           # Drizzle schema
    ├── repositories/ # Data access
    └── services/     # Business logic
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
- **Macro pattern**: Reusable Elysia middleware
- **Drizzle schemas**: `src/domain/*/db/schema.ts`

## Anti-Patterns

- Cross-domain imports (use service layer)
- Direct SQL (use Drizzle queries)
- Blocking operations in handlers

## Database

- **PostgreSQL**: Drizzle ORM, domain-specific schemas
- **MongoDB**: Authenticator credentials storage
- **Migrations**: `drizzle/{prod,dev}/` directories

## Testing

- Vitest with Node environment
- Sequential execution (stateful mocks)
- Mocks: `test/mock/` (viem, drizzle, webauthn, bun)

## Notes

- 174 TS files
- WebAuthn via ox/WebAuthnP256
- Merkle tree oracle for purchase proofs
- LRU caching for token metadata
