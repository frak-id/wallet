# Backend Architecture Deep Dive

**Service**: `services/backend/`
**Framework**: Elysia.js
**Lines of Code**: ~12,800
**Files**: ~100 TypeScript files

---

## Executive Summary

Your backend serves **4 different consumers** with different needs:
1. **Wallet App** - User-facing wallet operations
2. **Listener App** - Iframe communication, interactions
3. **SDK** - Third-party integrations
4. **Dashboard** - Business management interface

The current architecture **attempts DDD** but has **blurred boundaries** between domains and infrastructure. The "common" directory has become a **dumping ground** that creates tight coupling across all domains.

**Grade: C+ (Good intentions, needs structural refactoring)**

---

## Current Architecture Overview

### Directory Structure

```
services/backend/src/
├── domain/                    # 9 domains, 70 files
│   ├── 6degrees/             # ❌ Integration, not domain
│   ├── airtable/             # ❌ Integration, not domain
│   ├── auth/                 # ✅ Authentication domain
│   ├── business/             # ⚠️ Vague boundary
│   ├── interactions/         # ⚠️ Mixed concerns
│   ├── notifications/        # ✅ Push notifications
│   ├── oracle/               # ⚠️ Mixed concerns
│   ├── pairing/              # ✅ Device pairing
│   └── wallet/               # ⚠️ Thin wrapper
├── api/                       # BFF pattern (good!)
│   ├── business/             # Dashboard API
│   ├── wallet/               # Wallet/Listener/SDK API
│   ├── external/             # Webhooks
│   └── common/
├── common/                    # ❌ ANTI-PATTERN
│   ├── repositories/         # Infrastructure + Domain concepts
│   ├── services/             # DB clients, blockchain, JWT
│   ├── macro/                # Elysia macros
│   └── utils/
├── jobs/                      # Scheduled tasks
│   ├── pairing.ts
│   ├── oracle.ts
│   └── interactions/
└── utils/
    ├── elysia/
    ├── typebox/
    └── siwe/
```

---

## Problem Analysis: Why Are You "Lost" in the Architecture?

### Problem 1: The "Common" Directory Anti-Pattern

**Location**: `/services/backend/src/common/`

#### What's Inside:
```typescript
// common/index.ts exports (17 total):

// Infrastructure
export { db }                               // Postgres client
export { viemClient }                       // Blockchain client
export { getMongoDb }                       // MongoDB helper
export { logger }                           // Pino logger

// Repositories (Mix of Infrastructure + Domain)
export { adminWalletsRepository }           // Infrastructure (key mgmt)
export { interactionDiamondRepository }     // Infrastructure (contract registry)
export { pricingRepository }                // Infrastructure (external API)
export { RolesRepository }                  // ❌ DOMAIN CONCEPT (authorization)

// Services
export { JWTContext }                       // Authentication service
export { sessionContext }                   // Session middleware

// Macros
export { smartWalletContext }               // Smart wallet middleware
```

#### Why This Is Broken:

1. **Mixes Infrastructure with Domain Logic**
   - `db`, `viemClient`, `getMongoDb` are **infrastructure** (should be injected)
   - `RolesRepository` is a **domain concept** (authorization)
   - Everything depends on "common", creating a **god module**

2. **Creates Tight Coupling**
   ```typescript
   // Found in 20+ domain files:
   import { db, viemClient, adminWalletsRepository } from "@backend-common";
   ```

3. **Violates DDD Principles**
   - Domains should be **autonomous** with clear boundaries
   - Infrastructure should be **injected** via dependency injection
   - Domain services should **not import infrastructure directly**

4. **Makes Testing Difficult**
   - Can't mock database without replacing global `db`
   - Can't test domains in isolation
   - All tests depend on infrastructure setup

#### Dependency Graph (Simplified):
```
common/
├── Imported by: auth/ (5 files)
├── Imported by: interactions/ (8 files)
├── Imported by: oracle/ (6 files)
├── Imported by: pairing/ (4 files)
├── Imported by: business/ (3 files)
├── Imported by: wallet/ (2 files)
└── Imported by: api/ (12 files)

Total: 40+ files depend on "common"
```

---

### Problem 2: Cross-Domain Dependencies

**Location**: `/services/backend/src/domain/pairing/context.ts`

#### Example of Violation:
```typescript
export namespace PairingContext {
    // ❌ Direct dependency on Auth domain
    const connectionRepository = new PairingConnectionRepository(
        AuthContext.services.walletSdkSession
    );

    // ❌ Direct dependency on Notifications domain
    const routerRepository = new PairingRouterRepository(
        NotificationContext.services.notifications
    );

    export const services = {
        connections: new PairingConnectionService(
            connectionRepository,
            routerRepository
        )
    };
}
```

#### Why This Is Broken:

1. **Breaks Bounded Context Isolation**
   - Pairing domain knows about Auth and Notifications internals
   - Changes in Auth/Notifications break Pairing
   - Can't deploy domains independently

2. **Creates Circular Dependency Risk**
   ```
   Pairing → Auth → ?
   Pairing → Notifications → ?
   ```

3. **Violates DDD Strategic Design**
   - Bounded contexts should communicate via:
     - **Domain Events** (async, decoupled)
     - **Anti-Corruption Layers** (adapters)
     - **Shared Kernel** (minimal, explicit)

#### Proper DDD Approach:
```typescript
// Using Domain Events
export namespace PairingContext {
    // Inject event bus instead of other domains
    const connectionRepository = new PairingConnectionRepository(eventBus);

    export const services = {
        connections: new PairingConnectionService(connectionRepository)
    };
}

// In repository
class PairingConnectionRepository {
    constructor(private eventBus: EventBus) {}

    async createConnection(data: ConnectionData) {
        const connection = await this.save(data);

        // Publish event instead of calling other domain
        await this.eventBus.publish({
            type: "PairingConnectionCreated",
            aggregateId: connection.id,
            payload: { sessionId: connection.sessionId }
        });

        return connection;
    }
}

// Auth domain subscribes to event
AuthContext.eventBus.subscribe("PairingConnectionCreated", async (event) => {
    // Handle in auth domain
    await AuthContext.services.walletSdkSession.linkToConnection(event.payload);
});
```

---

### Problem 3: Fake Domains (Integrations as Domains)

#### Case Study: 6degrees Domain

**Location**: `/services/backend/src/domain/6degrees/`

**Files**:
- `context.ts` - External API client setup
- `services/cardBridge.ts` - External API wrapper
- `db/schema.ts` - Routing table schema
- `repositories/routing.ts` - Database queries

**Analysis**:
```typescript
// domain/6degrees/context.ts
export namespace SixDegreesContext {
    export const api = ky.create({
        prefixUrl: "https://prodbe-f2m.6degrees.co/",  // External service!
        headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.SIX_DEGREES_API_KEY,
        },
    });

    const repository = new SixDegreesRoutingRepository();

    export const services = {
        cardBridge: new CardBridgeService(api, repository),
    };
}
```

**Why This Is Wrong**:
1. **6degrees is NOT a bounded context** in your business domain
2. It's an **external integration** (payment card provider)
3. Should be in `infrastructure/integrations/sixdegrees/`
4. The routing tables are **infrastructure concerns** (caching external data)

**Proper Architecture**:
```
infrastructure/integrations/sixdegrees/
├── SixDegreesClient.ts      # HTTP client wrapper
├── SixDegreesAdapter.ts     # Anti-corruption layer
├── schema.ts                # Cache tables
└── repository.ts            # Cache queries

// Used by actual domain
domain/payments/
├── PaymentService.ts        # Uses adapter
└── repositories/
    └── PaymentRepository.ts
```

#### Case Study: Airtable Domain

**Location**: `/services/backend/src/domain/airtable/`

Same issue - **Airtable is a third-party CRM**, not a business domain.

**Should be**: `infrastructure/integrations/airtable/`

---

### Problem 4: Vague Domain Boundaries

#### Case Study: "Business" Domain

**Location**: `/services/backend/src/domain/business/`

**Files**:
- `repositories/DnsCheckRepository.ts` - DNS validation
- `repositories/MintRepository.ts` - Blockchain minting

**Problems**:
1. **"Business" is not a domain** - it's an organizational term
2. **DNS checks** are infrastructure utilities
3. **Minting** could be its own domain or part of "products"

**What This Domain Actually Contains**:
- DNS verification for custom domains
- Product NFT minting
- No clear ubiquitous language
- No business logic, just utilities

**Recommendation**: Split into:
- DNS → `infrastructure/dns/`
- Minting → `domain/products/` or `domain/minting/`

---

### Problem 5: Centralized Database Client

**Location**: `/services/backend/src/common/services/postgres.ts`

```typescript
import { drizzle } from "drizzle-orm/node-postgres";

// ❌ All domain schemas imported in one place
import { fixedRoutingTable, walletRoutingTable } from "@backend-domain/6degrees/db/schema";
import {
    backendTrackerTable,
    pendingInteractionsTable,
    purchaseTrackerTable,
    pushedInteractionsTable,
} from "@backend-domain/interactions/db/schema";
import { pushTokensTable } from "@backend-domain/notifications/db/schema";
import {
    productOracleTable,
    purchaseItemTable,
    purchaseStatusTable,
} from "@backend-domain/oracle/db/schema";
import { pairingSignatureRequestTable, pairingTable } from "@backend-domain/pairing/db/schema";

// ❌ Global database instance with all schemas
export const db = drizzle({
    client,
    schema: {
        // 6degrees
        fixedRoutingTable,
        walletRoutingTable,
        // interactions
        backendTrackerTable,
        pendingInteractionsTable,
        purchaseTrackerTable,
        pushedInteractionsTable,
        // notifications
        pushTokensTable,
        // oracle
        productOracleTable,
        purchaseItemTable,
        purchaseStatusTable,
        // pairing
        pairingSignatureRequestTable,
        pairingTable,
    },
});
```

**Why This Defeats Domain Isolation**:

1. **Global Schema Visibility**
   - All domains can see all tables
   - No enforcement of bounded context boundaries
   - Cross-domain queries are easy (and tempting)

2. **Single Connection Pool**
   - All domains share same connection pool
   - Can't optimize connections per domain
   - Can't scale domains independently

3. **Testing Nightmare**
   - Must set up ALL schemas for ANY domain test
   - Can't test domains in isolation
   - Slow test setup

4. **Deployment Coupling**
   - Schema changes in one domain affect all
   - Can't version schemas independently
   - Must coordinate migrations

**Proper DDD Approach**:
```typescript
// infrastructure/persistence/createDatabaseClient.ts
export function createDatabaseClient<TSchema extends Record<string, unknown>>(
    schema: TSchema
) {
    return drizzle({
        client: pgPool,
        schema,
    });
}

// domain/interactions/infrastructure/database.ts
import { createDatabaseClient } from "@backend-infrastructure/persistence";
import * as schema from "./schema";

export const interactionsDb = createDatabaseClient(schema);

// domain/notifications/infrastructure/database.ts
import { createDatabaseClient } from "@backend-infrastructure/persistence";
import * as schema from "./schema";

export const notificationsDb = createDatabaseClient(schema);
```

Now each domain has its own typed client with only its schemas.

---

## Consumer Analysis: Multi-Consumer Backend

### Consumer 1: Wallet App

**API**: `/wallet`

**Endpoints Used**:
```typescript
GET  /wallet/balance/:address
GET  /wallet/sso/prepare
POST /wallet/sso/login
POST /wallet/interactions/push
GET  /wallet/notifications/vapid-public-key
POST /wallet/notifications/register
```

**Authentication**: Custom JWT in headers
```typescript
headers: {
    "x-wallet-auth": "jwt_token",
    "x-wallet-sdk-auth": "sdk_session_token"
}
```

**Use Cases**:
- Balance queries
- Interaction tracking
- Push notification registration
- SSO authentication
- Wallet session management

---

### Consumer 2: Listener App

**API**: `/wallet` (same as wallet app)

**Endpoints Used**:
```typescript
POST /wallet/interactions/push
GET  /wallet/notifications/vapid-public-key
POST /wallet/pairing/signature-request
GET  /wallet/pairing/connection/:pairingId
```

**Authentication**: Same as wallet app (custom JWT)

**Use Cases**:
- Iframe interaction tracking
- Pairing signature requests
- WebSocket connections for pairing
- Push notification setup

**Key Difference from Wallet**: Runs in iframe context, handles parent-iframe communication

---

### Consumer 3: SDK (Third-Party Integrations)

**API**: `/wallet` (same endpoint, different usage patterns)

**Endpoints Used**:
```typescript
POST /wallet/interactions/push       # Track user actions
GET  /wallet/balance/:address        # Display balances
POST /wallet/pairing/connect         # Connect external sites
```

**Authentication**: SDK session tokens
```typescript
headers: {
    "x-wallet-sdk-auth": "sdk_session_token"
}
```

**Use Cases**:
- Third-party sites tracking referrals
- External applications checking balances
- Partner integrations

**Security Model**:
- Origin validation
- Rate limiting per domain
- SDK session with restricted permissions

---

### Consumer 4: Dashboard

**API**: `/business`

**Endpoints Used**:
```typescript
POST /business/auth/login
POST /business/auth/logout
GET  /business/campaigns
POST /business/campaigns
GET  /business/campaigns/:id/stats
POST /business/notifications/send
GET  /business/roles
POST /business/products/mint
GET  /business/oracle/purchases
```

**Authentication**: SIWE (Sign-In With Ethereum) + iron-session cookies
```typescript
cookie: {
    businessSession: "encrypted_session_token"
}
```

**Session Format** (shared with Next.js frontend):
```typescript
interface BusinessSession {
    wallet: Address;
    siwe: {
        message: string;
        signature: Hex;
    };
}
```

**Use Cases**:
- Business authentication (SIWE)
- Campaign management (CRUD)
- Analytics and statistics
- Push notification campaigns
- Product minting
- Role management
- Purchase verification

---

### Multi-Consumer Complexity

```
                    ┌─────────────────┐
                    │  Elysia Backend │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  /wallet API │ │ /business API│ │ /external API│
    └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
           │                │                │
    ┌──────┴────────┐      │         ┌──────┴──────┐
    │               │      │         │             │
    ▼               ▼      ▼         ▼             ▼
┌────────┐   ┌──────────┐ ┌─────────┐ ┌────────┐ ┌─────────┐
│ Wallet │   │ Listener │ │Dashboard│ │  SDK   │ │Webhooks │
│  App   │   │   App    │ │         │ │ Users  │ │         │
└────────┘   └──────────┘ └─────────┘ └────────┘ └─────────┘
```

**The Challenge**:
- Different authentication methods
- Different authorization models
- Shared domains (interactions, notifications)
- Different performance requirements

**Current Issues**:
1. **Wallet/Listener/SDK share `/wallet` API** but have different needs
2. **Dashboard has tight coupling** via iron-session cookies
3. **No API versioning** - breaking changes affect all consumers
4. **No rate limiting per consumer type**

---

## Proposed Backend Architecture (DDD-Compliant)

### Phase 1: Restructure (Immediate)

```
services/backend/src/
├── domain/                           # Bounded contexts only
│   ├── authentication/               # ✅ User authentication
│   │   ├── domain/
│   │   │   ├── Authenticator.ts     # Entity
│   │   │   └── Session.ts           # Value object
│   │   ├── application/
│   │   │   ├── WebAuthNService.ts   # Use case
│   │   │   └── SessionService.ts    # Use case
│   │   ├── infrastructure/
│   │   │   ├── AuthenticatorRepository.ts
│   │   │   └── database.ts          # Domain-specific DB client
│   │   └── dto/
│   │
│   ├── authorization/                # ✅ NEW - Roles & permissions
│   │   ├── domain/
│   │   │   └── Role.ts
│   │   ├── application/
│   │   │   └── RolesService.ts
│   │   └── infrastructure/
│   │       └── RolesRepository.ts   # Moved from common
│   │
│   ├── wallet/                       # ✅ Wallet operations
│   │   ├── domain/
│   │   │   └── Balance.ts
│   │   ├── application/
│   │   │   └── BalanceService.ts
│   │   └── infrastructure/
│   │       └── IndexerAdapter.ts    # External API
│   │
│   ├── campaigns/                    # ✅ NEW - Split from interactions
│   │   ├── domain/
│   │   │   ├── Campaign.ts
│   │   │   ├── Reward.ts
│   │   │   └── RewardRule.ts
│   │   ├── application/
│   │   │   ├── CampaignService.ts
│   │   │   └── RewardCalculator.ts
│   │   └── infrastructure/
│   │
│   ├── interactions/                 # ✅ REFOCUSED - User actions only
│   │   ├── domain/
│   │   │   ├── Interaction.ts
│   │   │   └── InteractionStatus.ts
│   │   ├── application/
│   │   │   ├── InteractionProcessor.ts
│   │   │   └── InteractionSimulator.ts
│   │   ├── infrastructure/
│   │   │   ├── database.ts
│   │   │   └── PendingInteractionsRepository.ts
│   │   └── dto/
│   │
│   ├── purchases/                    # ✅ NEW - Split from oracle
│   │   ├── domain/
│   │   │   ├── Purchase.ts
│   │   │   ├── PurchaseItem.ts
│   │   │   └── PurchaseStatus.ts
│   │   ├── application/
│   │   │   ├── PurchaseVerifier.ts
│   │   │   └── MerkleProofService.ts
│   │   └── infrastructure/
│   │       ├── database.ts
│   │       └── PurchaseRepository.ts
│   │
│   ├── notifications/                # ✅ KEEP - Clean domain
│   │   ├── domain/
│   │   │   └── PushToken.ts
│   │   ├── application/
│   │   │   └── NotificationService.ts
│   │   └── infrastructure/
│   │       └── database.ts
│   │
│   ├── pairing/                      # ✅ REFACTOR - Remove cross-domain deps
│   │   ├── domain/
│   │   │   ├── PairingConnection.ts
│   │   │   └── SignatureRequest.ts
│   │   ├── application/
│   │   │   ├── PairingService.ts
│   │   │   └── SignatureService.ts
│   │   └── infrastructure/
│   │       └── database.ts
│   │
│   └── products/                     # ✅ NEW - Minting from "business"
│       ├── domain/
│       │   └── Product.ts
│       ├── application/
│       │   └── MintingService.ts
│       └── infrastructure/
│           └── BlockchainAdapter.ts
│
├── infrastructure/                   # Infrastructure concerns
│   ├── persistence/
│   │   ├── createDatabaseClient.ts  # Factory for domain DBs
│   │   ├── postgres.ts              # Connection pool
│   │   └── mongodb.ts               # MongoDB helper
│   ├── blockchain/
│   │   ├── createViemClient.ts      # Blockchain client factory
│   │   └── contracts.ts             # Contract ABIs
│   ├── keys/
│   │   └── AdminWalletsRepository.ts
│   ├── pricing/
│   │   └── PricingRepository.ts     # CoinGecko API
│   ├── dns/
│   │   └── DnsVerifier.ts           # From "business" domain
│   ├── messaging/
│   │   ├── EventBus.ts              # Domain events
│   │   ├── DomainEvent.ts           # Base event type
│   │   └── EventStore.ts            # Optional: persist events
│   └── integrations/
│       ├── sixdegrees/              # Moved from domain/6degrees
│       │   ├── SixDegreesClient.ts
│       │   ├── SixDegreesAdapter.ts
│       │   ├── schema.ts
│       │   └── repository.ts
│       ├── airtable/                # Moved from domain/airtable
│       │   ├── AirtableClient.ts
│       │   └── AirtableAdapter.ts
│       ├── shopify/                 # From oracle domain
│       │   └── ShopifyWebhookHandler.ts
│       └── woocommerce/             # From oracle domain
│           └── WooCommerceWebhookHandler.ts
│
├── api/                              # BFF pattern (keep!)
│   ├── business/                    # Dashboard API
│   ├── wallet/                      # Wallet/Listener/SDK API
│   ├── external/                    # Webhooks API
│   └── common/                      # Shared middleware
│
├── jobs/                             # Scheduled tasks
│   ├── interactions/
│   ├── pairing/
│   └── oracle/
│
└── utils/                            # Utilities
    ├── elysia/
    ├── typebox/
    └── siwe/
```

---

### Phase 2: Implement Domain Events

**Create Event System**:

```typescript
// infrastructure/messaging/DomainEvent.ts
export interface DomainEvent {
    eventId: string;
    eventType: string;
    occurredAt: Date;
    aggregateId: string;
    aggregateType: string;
    payload: Record<string, unknown>;
    metadata?: {
        userId?: string;
        correlationId?: string;
    };
}

// infrastructure/messaging/EventBus.ts
export class EventBus {
    private handlers = new Map<string, Array<(event: DomainEvent) => Promise<void>>>();

    async publish(event: DomainEvent): Promise<void> {
        const handlers = this.handlers.get(event.eventType) || [];

        // Parallel execution
        await Promise.all(handlers.map(handler =>
            handler(event).catch(err => {
                logger.error("Event handler failed", { event, error: err });
                // Consider retry logic or dead letter queue
            })
        ));
    }

    subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, []);
        }
        this.handlers.get(eventType)!.push(handler);
    }

    unsubscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
        const handlers = this.handlers.get(eventType);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
}

// Singleton instance
export const eventBus = new EventBus();
```

**Event Types**:

```typescript
// domain/authentication/events/WalletAuthenticated.ts
export interface WalletAuthenticatedEvent extends DomainEvent {
    eventType: "authentication.wallet.authenticated";
    payload: {
        wallet: Address;
        authenticatorId: string;
        sessionId: string;
    };
}

// domain/interactions/events/InteractionCreated.ts
export interface InteractionCreatedEvent extends DomainEvent {
    eventType: "interactions.interaction.created";
    payload: {
        interactionId: string;
        productId: string;
        campaignId: string;
        userId: string;
    };
}

// domain/purchases/events/PurchaseVerified.ts
export interface PurchaseVerifiedEvent extends DomainEvent {
    eventType: "purchases.purchase.verified";
    payload: {
        purchaseId: string;
        orderId: string;
        amount: string;
        currency: string;
    };
}
```

**Usage Example**:

```typescript
// domain/authentication/application/SessionService.ts
export class SessionService {
    constructor(
        private repository: SessionRepository,
        private eventBus: EventBus
    ) {}

    async createSession(wallet: Address, authenticatorId: string): Promise<Session> {
        const session = await this.repository.create({
            wallet,
            authenticatorId,
            expiresAt: addDays(new Date(), 7),
        });

        // Publish domain event
        await this.eventBus.publish({
            eventId: randomUUID(),
            eventType: "authentication.wallet.authenticated",
            occurredAt: new Date(),
            aggregateId: session.id,
            aggregateType: "Session",
            payload: {
                wallet,
                authenticatorId,
                sessionId: session.id,
            },
        });

        return session;
    }
}

// domain/pairing/application/PairingService.ts
export class PairingService {
    constructor(
        private repository: PairingRepository,
        private eventBus: EventBus
    ) {
        // Subscribe to authentication events
        this.eventBus.subscribe(
            "authentication.wallet.authenticated",
            this.handleWalletAuthenticated.bind(this)
        );
    }

    private async handleWalletAuthenticated(event: DomainEvent) {
        const { sessionId, wallet } = event.payload as {
            sessionId: string;
            wallet: Address;
        };

        // Link pending pairing connections to authenticated session
        await this.repository.linkPendingConnections(wallet, sessionId);
    }
}
```

---

### Phase 3: Dependency Injection

**Create Context Factory**:

```typescript
// infrastructure/DependencyContainer.ts
export class DependencyContainer {
    private static instance: DependencyContainer;
    private services = new Map<string, any>();

    static getInstance(): DependencyContainer {
        if (!this.instance) {
            this.instance = new DependencyContainer();
        }
        return this.instance;
    }

    register<T>(key: string, factory: () => T): void {
        this.services.set(key, factory);
    }

    resolve<T>(key: string): T {
        const factory = this.services.get(key);
        if (!factory) {
            throw new Error(`Service not registered: ${key}`);
        }
        return factory();
    }
}

// infrastructure/setup.ts
export function setupDependencies() {
    const container = DependencyContainer.getInstance();

    // Infrastructure
    container.register("db", () => createDatabaseClient({}));
    container.register("viemClient", () => createViemClient());
    container.register("eventBus", () => new EventBus());

    // Authentication domain
    container.register("authRepository", () =>
        new AuthenticatorRepository(container.resolve("mongoDb"))
    );
    container.register("sessionService", () =>
        new SessionService(
            container.resolve("authRepository"),
            container.resolve("eventBus")
        )
    );

    // ... register all services
}

// Usage in API
import { DependencyContainer } from "@backend-infrastructure/DependencyContainer";

app.post("/wallet/login", async ({ body }) => {
    const container = DependencyContainer.getInstance();
    const sessionService = container.resolve<SessionService>("sessionService");

    return sessionService.createSession(body.wallet, body.authenticatorId);
});
```

---

## Migration Strategy

### Step 1: Create Infrastructure Layer (Week 1)

1. **Create directories**:
   ```bash
   mkdir -p src/infrastructure/{persistence,blockchain,keys,pricing,dns,messaging,integrations}
   ```

2. **Move infrastructure from common**:
   ```bash
   # Database clients
   mv src/common/services/postgres.ts src/infrastructure/persistence/
   mv src/common/services/db.ts src/infrastructure/persistence/mongodb.ts

   # Blockchain
   mv src/common/services/blockchain.ts src/infrastructure/blockchain/client.ts

   # Repositories (infrastructure-only)
   mv src/common/repositories/AdminWalletsRepository.ts src/infrastructure/keys/
   mv src/common/repositories/PricingRepository.ts src/infrastructure/pricing/
   mv src/common/repositories/InteractionDiamondRepository.ts src/infrastructure/blockchain/
   ```

3. **Create domain-specific DB clients**:
   ```typescript
   // infrastructure/persistence/createDatabaseClient.ts
   export function createDatabaseClient<TSchema>(schema: TSchema) {
       return drizzle({ client: pgPool, schema });
   }

   // domain/interactions/infrastructure/database.ts
   import { createDatabaseClient } from "@backend-infrastructure/persistence";
   import * as schema from "../db/schema";

   export const db = createDatabaseClient(schema);
   ```

4. **Update imports** (use find-replace):
   ```typescript
   // Before
   import { db } from "@backend-common";

   // After
   import { db } from "../infrastructure/database";
   ```

---

### Step 2: Move Integrations (Week 1)

1. **Move 6degrees**:
   ```bash
   mv src/domain/6degrees src/infrastructure/integrations/sixdegrees
   ```

2. **Move airtable**:
   ```bash
   mv src/domain/airtable src/infrastructure/integrations/airtable
   ```

3. **Create adapters** (anti-corruption layers):
   ```typescript
   // infrastructure/integrations/sixdegrees/SixDegreesAdapter.ts
   export class SixDegreesAdapter {
       constructor(private client: SixDegreesClient) {}

       async getBridgeAddress(wallet: Address): Promise<Address | null> {
           // Translate external API to domain model
           const response = await this.client.getRouting(wallet);
           return response.bridge_address || null;
       }
   }
   ```

---

### Step 3: Extract Domain Services (Week 2)

1. **Move RolesRepository to authorization domain**:
   ```bash
   mkdir -p src/domain/authorization/{domain,application,infrastructure}
   mv src/common/repositories/RolesRepository.ts src/domain/authorization/infrastructure/
   ```

2. **Create domain structure**:
   ```typescript
   // domain/authorization/domain/Role.ts
   export type Role = {
       isOwner: boolean;
       roles: bigint;
   };

   // domain/authorization/application/RolesService.ts
   export class RolesService {
       constructor(private repository: RolesRepository) {}

       async getRolesOnProduct(params: {
           wallet: Address;
           productId: Hex;
       }): Promise<Role> {
           return this.repository.getRolesOnProduct(params);
       }

       hasRole(role: Role, requiredRole: bigint): boolean {
           return role.isOwner || (role.roles & requiredRole) === requiredRole;
       }
   }
   ```

---

### Step 4: Implement Event Bus (Week 2)

1. **Create event infrastructure**:
   ```bash
   mkdir -p src/infrastructure/messaging
   # Create EventBus, DomainEvent types
   ```

2. **Add event publishing to key operations**:
   ```typescript
   // domain/authentication/application/SessionService.ts
   async createSession(...) {
       const session = await this.repository.create(...);

       await this.eventBus.publish({
           eventType: "authentication.wallet.authenticated",
           // ...
       });

       return session;
   }
   ```

3. **Replace cross-domain imports with event subscriptions**:
   ```typescript
   // domain/pairing/context.ts
   export namespace PairingContext {
       // Before: Direct dependency
       // const connectionRepository = new PairingConnectionRepository(
       //     AuthContext.services.walletSdkSession
       // );

       // After: Event subscription
       const connectionRepository = new PairingConnectionRepository();

       eventBus.subscribe("authentication.wallet.authenticated", async (event) => {
           await connectionRepository.linkToSession(event.payload);
       });
   }
   ```

---

### Step 5: Split Mixed Domains (Week 3)

#### Split "interactions" → "campaigns" + "interactions"

1. **Extract campaign logic**:
   ```bash
   mkdir -p src/domain/campaigns/{domain,application,infrastructure}

   # Move campaign-specific files
   mv src/domain/interactions/services/CampaignRewardsService.ts src/domain/campaigns/application/
   ```

2. **Define campaign domain**:
   ```typescript
   // domain/campaigns/domain/Campaign.ts
   export type Campaign = {
       id: string;
       productId: string;
       rewardRules: RewardRule[];
       active: boolean;
   };

   // domain/campaigns/domain/RewardRule.ts
   export type RewardRule = {
       type: "referral" | "purchase" | "interaction";
       amount: bigint;
       conditions: Record<string, unknown>;
   };
   ```

3. **Update interactions domain** to focus only on user actions:
   ```typescript
   // domain/interactions/application/InteractionProcessor.ts
   export class InteractionProcessor {
       async processInteraction(interaction: Interaction): Promise<void> {
           // Validate and store interaction
           await this.repository.save(interaction);

           // Publish event for campaign domain to handle
           await this.eventBus.publish({
               eventType: "interactions.interaction.created",
               payload: { interactionId: interaction.id, ... }
           });
       }
   }

   // domain/campaigns/application/RewardCalculator.ts
   export class RewardCalculator {
       constructor(eventBus: EventBus) {
           // Subscribe to interaction events
           eventBus.subscribe("interactions.interaction.created",
               this.calculateReward.bind(this)
           );
       }

       private async calculateReward(event: DomainEvent): Promise<void> {
           // Calculate reward based on campaign rules
       }
   }
   ```

#### Split "oracle" → "purchases" + "oracle infrastructure"

1. **Extract purchase domain**:
   ```bash
   mkdir -p src/domain/purchases/{domain,application,infrastructure}

   # Move purchase-specific files
   mv src/domain/oracle/db/schema.ts src/domain/purchases/db/
   mv src/domain/oracle/repositories/PurchaseRepository.ts src/domain/purchases/infrastructure/
   ```

2. **Keep oracle as infrastructure**:
   ```bash
   mv src/domain/oracle src/infrastructure/verification/oracle
   ```

3. **Define purchase domain**:
   ```typescript
   // domain/purchases/domain/Purchase.ts
   export type Purchase = {
       id: string;
       orderId: string;
       productId: string;
       userId: string;
       amount: bigint;
       status: PurchaseStatus;
       verifiedAt?: Date;
   };

   // domain/purchases/application/PurchaseVerifier.ts
   export class PurchaseVerifier {
       constructor(
           private repository: PurchaseRepository,
           private oracleService: OracleService  // from infrastructure
       ) {}

       async verifyPurchase(purchase: Purchase): Promise<boolean> {
           const proof = await this.oracleService.getMerkleProof(purchase.id);

           if (proof.valid) {
               await this.repository.markAsVerified(purchase.id);

               await this.eventBus.publish({
                   eventType: "purchases.purchase.verified",
                   payload: { purchaseId: purchase.id, ... }
               });

               return true;
           }

           return false;
       }
   }
   ```

---

### Step 6: Remove "common" Directory (Week 3)

1. **Verify all exports moved**:
   ```bash
   # Should have 0 imports
   rg "from \"@backend-common\"" src/
   ```

2. **Delete common directory**:
   ```bash
   rm -rf src/common
   ```

3. **Update tsconfig paths**:
   ```json
   {
       "compilerOptions": {
           "paths": {
               "@backend-infrastructure/*": ["./src/infrastructure/*"],
               "@backend-domain/*": ["./src/domain/*"]
           }
       }
   }
   ```

---

## API Consumer Strategy

### Strategy 1: API Versioning

Add versioning to support breaking changes:

```typescript
// api/wallet/v1/index.ts
export const walletApiV1 = new Elysia({ prefix: "/wallet/v1" })
    .post("/interactions/push", ...)
    .get("/balance/:address", ...);

// api/wallet/v2/index.ts
export const walletApiV2 = new Elysia({ prefix: "/wallet/v2" })
    .post("/interactions/push", ...)  // New format
    .get("/balance/:address", ...);

// index.ts
const app = new Elysia()
    .use(walletApiV1)  // Legacy support
    .use(walletApiV2)  // New version
    .use(businessApi);
```

### Strategy 2: Consumer-Specific Rate Limiting

```typescript
// api/common/middleware/rateLimiting.ts
export const rateLimitByConsumer = new Elysia()
    .derive(({ headers }) => {
        const consumer = identifyConsumer(headers);
        return { consumer };
    })
    .onBeforeHandle(({ consumer, rateLimiter }) => {
        const limits = {
            wallet: { rpm: 1000 },      // High limit for user app
            dashboard: { rpm: 500 },    // Medium for dashboard
            sdk: { rpm: 100 },          // Lower for third-party
            webhook: { rpm: 50 },       // Low for webhooks
        };

        if (!rateLimiter.check(consumer.type, limits[consumer.type])) {
            return error(429, "Rate limit exceeded");
        }
    });
```

### Strategy 3: Decouple Dashboard Session

**Current Problem**: Dashboard and backend share iron-session encryption key

**Solution**: Use API keys for dashboard

```typescript
// dashboard/src/context/auth/actions/login.ts (NEW APPROACH)
export async function login(wallet: Address, signature: Hex) {
    // 1. Verify SIWE signature on backend
    const { apiKey } = await businessApi.auth.login.post({
        wallet,
        signature,
    });

    // 2. Store API key in HTTP-only cookie (Next.js only)
    cookies().set("dashboard_api_key", apiKey, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 60 * 60 * 24 * 7, // 7 days
    });
}

// backend/src/api/business/middleware/auth.ts (NEW APPROACH)
export const businessAuth = new Elysia()
    .guard({ cookie: t.Object({ dashboard_api_key: t.Optional(t.String()) }) })
    .resolve(async ({ cookie }) => {
        const apiKey = cookie.dashboard_api_key?.value;
        if (!apiKey) {
            return error(401, "No API key provided");
        }

        // Verify API key against database
        const session = await apiKeyRepository.verify(apiKey);
        if (!session) {
            return error(401, "Invalid API key");
        }

        return { session };
    })
    .macro({ authenticated() { ... } });
```

Benefits:
- No shared encryption key
- Backend can revoke API keys
- Independent deployment
- Standard REST API authentication

---

## Testing Strategy

### Unit Tests (Domain Logic)

```typescript
// domain/campaigns/application/RewardCalculator.test.ts
import { describe, it, expect, mock } from "bun:test";
import { RewardCalculator } from "./RewardCalculator";

describe("RewardCalculator", () => {
    it("calculates referral rewards correctly", async () => {
        const mockRepository = {
            getCampaign: mock(() => Promise.resolve({
                id: "campaign-1",
                rewardRules: [
                    { type: "referral", amount: 1000n, conditions: {} }
                ]
            })),
            saveReward: mock(() => Promise.resolve())
        };

        const calculator = new RewardCalculator(mockRepository);

        const reward = await calculator.calculateReward({
            campaignId: "campaign-1",
            interactionType: "referral",
            userId: "user-1"
        });

        expect(reward).toBe(1000n);
        expect(mockRepository.saveReward).toHaveBeenCalled();
    });
});
```

### Integration Tests (API + Database)

```typescript
// api/wallet/interactions.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../../index";
import { testDb, cleanupTestDb } from "../../test/helpers";

describe("POST /wallet/interactions/push", () => {
    beforeAll(async () => {
        await testDb.migrate();
    });

    afterAll(async () => {
        await cleanupTestDb();
    });

    it("creates pending interaction", async () => {
        const response = await app.handle(
            new Request("http://localhost/wallet/interactions/push", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId: "0x...",
                    interactionType: "click",
                    data: {}
                })
            })
        );

        expect(response.status).toBe(200);

        const interaction = await testDb
            .select()
            .from(pendingInteractionsTable)
            .where(eq(pendingInteractionsTable.productId, "0x..."));

        expect(interaction).toBeDefined();
    });
});
```

### E2E Tests (Consumer Scenarios)

```typescript
// e2e/wallet-flow.test.ts
import { describe, it, expect } from "bun:test";
import { WalletClient } from "./clients/WalletClient";

describe("Wallet App Flow", () => {
    it("completes full interaction flow", async () => {
        const client = new WalletClient("http://localhost:3000");

        // 1. Authenticate
        await client.login(testWallet, signature);

        // 2. Push interaction
        const interactionId = await client.pushInteraction({
            productId: "0x...",
            type: "referral"
        });

        expect(interactionId).toBeDefined();

        // 3. Check balance
        const balance = await client.getBalance(testWallet);
        expect(balance.pending).toBeGreaterThan(0n);

        // 4. Wait for processing
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 5. Verify reward
        const updatedBalance = await client.getBalance(testWallet);
        expect(updatedBalance.confirmed).toBeGreaterThan(balance.confirmed);
    });
});
```

---

## Monitoring & Observability

### Add Prometheus Metrics

```typescript
// infrastructure/monitoring/metrics.ts
import { prometheus } from "@elysiajs/prometheus";

export const metricsPlugin = prometheus({
    endpoint: "/metrics",
});

// Custom metrics
export const interactionCounter = new Counter({
    name: "interactions_total",
    help: "Total number of interactions processed",
    labelNames: ["type", "status"],
});

export const balanceQueryDuration = new Histogram({
    name: "balance_query_duration_seconds",
    help: "Duration of balance queries",
    labelNames: ["wallet"],
});

// Usage in service
export class InteractionProcessor {
    async process(interaction: Interaction): Promise<void> {
        interactionCounter.inc({ type: interaction.type, status: "pending" });

        try {
            await this.repository.save(interaction);
            interactionCounter.inc({ type: interaction.type, status: "success" });
        } catch (error) {
            interactionCounter.inc({ type: interaction.type, status: "error" });
            throw error;
        }
    }
}
```

### Add Structured Logging

```typescript
// infrastructure/logging/logger.ts
import pino from "pino";

export const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    transport: {
        target: "pino-pretty",
        options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
        },
    },
});

// Usage
logger.info({
    domain: "interactions",
    action: "process",
    interactionId: "abc123"
}, "Processing interaction");
```

---

## Deployment Considerations

### Database Migrations

With domain-specific schemas, migrations need coordination:

```bash
# Option 1: Monolithic migrations (current)
bun db:migrate  # Applies all domain migrations

# Option 2: Per-domain migrations (future)
bun db:migrate --domain interactions
bun db:migrate --domain campaigns
```

### Rolling Deployments

Event-driven architecture enables zero-downtime deploys:

1. Deploy new version (subscribes to events)
2. Old version continues processing
3. Gradually shift traffic
4. Old version unsubscribes from events
5. Terminate old version

---

## Conclusion

Your backend is **architecturally ambitious** (attempting DDD) but **execution needs refinement**. The main issues are:

1. **"Common" directory defeats bounded contexts**
2. **Cross-domain dependencies break isolation**
3. **Integrations misplaced as domains**
4. **Centralized database client prevents domain autonomy**

The refactoring plan is **incremental and safe**:
- Week 1: Infrastructure layer
- Week 2: Domain events
- Week 3: Split mixed domains

After refactoring, you'll have:
- ✅ **Clear bounded contexts**
- ✅ **Event-driven communication**
- ✅ **Testable domains**
- ✅ **Scalable architecture**

This will make it **significantly easier** to reason about the codebase and add new features without fear of breaking existing functionality.
