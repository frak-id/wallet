# API Layer - Backend for Frontend (BFF) Architecture

This directory contains the API layer organized using the **Backend for Frontend (BFF)** pattern. Each API module is tailored to the specific needs of different consuming applications and external integrations.

## Architecture Overview

The API layer is separated from the domain layer to provide:
- **Application-specific APIs**: Each consumer gets an API tailored to their needs
- **Clear separation of concerns**: HTTP/API logic vs business logic
- **Independent evolution**: APIs can evolve independently without affecting domain logic
- **Future modularity**: Each API module can be extracted into separate packages

```
src/
├── api/                    # BFF API Layer (this directory)
│   ├── user/              # User/SDK APIs (wallet + tracking + identity)
│   │   ├── track/         # Arrival tracking (anonymous OK)
│   │   ├── identity/      # Identity resolution (future)
│   │   └── wallet/        # Wallet-specific (auth, pairing, balance)
│   ├── business/          # Business Dashboard APIs
│   ├── external/          # Third-party webhooks (Shopify, WooCommerce)
│   └── common/            # Shared utilities
├── domain/                # Pure business logic
└── common/                # Shared infrastructure
```

## API Modules

### 👤 User APIs (`/user`)
**Target Consumer**: SDK, Wallet Application, end users

The user API is organized hierarchically to support the user journey from anonymous tracking to wallet-connected user:

#### `/user/track` - Tracking (anonymous OK)
- `POST /user/track/arrival` - Record touchpoint when user arrives via referral link

#### `/user/identity` - Identity Resolution (future)
- `POST /user/identity/resolve` - Anonymous ID → identity group
- `POST /user/identity/link-customer` - Link merchant customer ID
- `POST /user/identity/connect-wallet` - Set wallet anchor

#### `/user/wallet` - Wallet-specific (requires auth)
- `GET /user/wallet/balance` - User balance information
- `GET /user/wallet/balance/claimable` - Claimable rewards
- `GET /user/wallet/balance/pending` - Pending balance
- `POST /user/wallet/auth/*` - WebAuthn authentication
- `WS /user/wallet/pairing/ws` - Device pairing websocket

**Characteristics**:
- Supports anonymous users (track, identity)
- Wallet endpoints require authentication
- SDK-facing, optimized for frontend consumption

### 📊 Business APIs (`/business`)
**Target Consumer**: Business Dashboard (SaaS application for companies)

**Endpoints**:
- `GET /business/roles` - User roles on products
- `GET /business/mint/verify` - Product mint verification
- `PUT /business/mint` - Product minting
- `POST /business/funding/getTestToken` - Test token funding
- `POST /business/notifications/send` - Notification broadcasting
- `{GET,POST,DELETE} /business/products/*/webhook/*` - Webhook management

**Characteristics**:
- Business-focused operations
- Complex authentication (business sessions)
- Admin and management operations
- Optimized for dashboard workflows

### 🔌 External APIs (`/ext`)
**Target Consumers**: Third-party services (Shopify, WooCommerce, custom webhooks)

**Endpoints**:
- `POST /ext/products/:productId/webhook/oracle/shopify` - Shopify order webhooks
- `POST /ext/products/:productId/webhook/oracle/woocommerce` - WooCommerce webhooks
- `POST /ext/products/:productId/webhook/oracle/custom` - Custom integration webhooks

**Characteristics**:
- Webhook receivers for e-commerce platforms
- Signature verification per platform
- Purchase/order event processing

### 🔧 Common APIs (`/common`)
**Target Consumers**: Internal services, shared utilities

**Endpoints**:
- `POST /common/airtable` - Airtable integrations
- `GET /common/common/adminWallet` - Admin wallet addresses
- `GET /common/common/rate` - Token pricing
- `GET /common/social/*` - Social redirect handling

**Characteristics**:
- Shared utilities
- Public-facing simple endpoints
- Cross-cutting concerns

## BFF Benefits

### 1. **Tailored APIs**
Each consuming application gets an API designed specifically for its use case:
- User API supports the full journey from anonymous to wallet-connected
- Business API provides admin-focused endpoints with complex business logic
- External API handles third-party webhook integrations

### 2. **Independent Evolution**
- Dashboard API can add complex business features without affecting wallet performance
- Wallet API can optimize for mobile without breaking dashboard functionality
- External APIs remain stable while internal APIs evolve rapidly

### 3. **Security Boundaries**
- Different authentication strategies per consumer
- Granular access control
- Reduced attack surface per application

### 4. **Performance Optimization**
- Response formats optimized per consumer
- Caching strategies tailored to usage patterns
- Rate limiting per application type

## Future Architecture

This BFF approach enables future extraction into microservices:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Business      │    │   SDK / Wallet  │    │   Third-party   │
│   Dashboard     │    │   Application   │    │   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Business API   │    │    User API     │    │  External API   │
│   (/business)   │    │    (/user)      │    │    (/ext)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────┐
                    │  Domain Layer   │
                    │   (Shared)      │
                    └─────────────────┘
```

## Implementation Guidelines

### Adding New Endpoints
1. **Identify the consumer**: Which application will use this endpoint?
2. **Choose the appropriate API module**:
   - `/user/track` - Anonymous user tracking (SDK)
   - `/user/identity` - Identity resolution (SDK)
   - `/user/wallet` - Wallet-specific operations (wallet app, SDK with auth)
   - `/business` - Dashboard operations
   - `/ext` - Third-party webhooks
   - `/common` - Shared utilities
3. **Extract from domain**: Move HTTP concerns from domain to API layer
4. **Keep domain pure**: Domain should only contain business logic

### API Design Principles
- **Consumer-first**: Design APIs for the specific needs of each consumer
- **Consistent within module**: Each API module should have consistent patterns
- **Minimal coupling**: APIs should not depend on each other
- **Domain separation**: Keep HTTP concerns separate from business logic

## Migration Status

- ✅ **User API**: Track arrival, wallet auth/pairing/balance implemented
- ✅ **Business API**: Roles, mint, funding, notifications, webhooks
- ✅ **External API**: Shopify, WooCommerce, custom webhooks
- ✅ **Common API**: Airtable, social, admin wallets, pricing
- 🚧 **User Identity API**: In progress (part of V2 refactor)

This architecture provides a solid foundation for scaling the backend as the ecosystem grows while maintaining clean separation of concerns and enabling independent evolution of each consumer application. 