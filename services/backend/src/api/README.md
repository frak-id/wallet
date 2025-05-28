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
│   ├── shared/            # Shared/External APIs
│   ├── dashboard/         # Business Dashboard APIs
│   ├── wallet/            # Wallet Application APIs
│   └── common/            # Common utilities (future)
├── domain/                # Pure business logic
└── common/                # Shared infrastructure
```

## API Modules

### 🌐 Shared/External APIs (`/shared`)
**Target Consumers**: External services, landing pages, third-party integrations

**Endpoints**:
- `POST /shared/airtable` - Airtable integrations for lead capture
- `GET /shared/common/adminWallet` - Admin wallet addresses
- `GET /shared/common/rate` - Token pricing information

**Characteristics**:
- Public-facing endpoints
- Minimal authentication requirements
- Used by services outside the main ecosystem
- Optimized for external consumption

### 📊 Dashboard APIs (`/dashboard`)
**Target Consumer**: Business Dashboard (SaaS application for companies)

**Endpoints**:
- `GET /dashboard/business/roles` - User roles on products
- `GET /dashboard/business/mint/verify` - Product mint verification
- `PUT /dashboard/business/mint` - Product minting
- `POST /dashboard/business/funding/getTestToken` - Test token funding
- `POST /dashboard/notifications/send` - Notification broadcasting
- `{GET,POST,DELETE} /dashboard/interactions/webhook/*` - Webhook management

**Characteristics**:
- Business-focused operations
- Complex authentication (business sessions)
- Admin and management operations
- Optimized for dashboard workflows

### 💳 Wallet APIs (`/wallet`)
**Target Consumer**: Wallet Application (user-facing SPA)

**Endpoints** (planned):
- `GET /wallet/balance` - User balance information
- `GET /wallet/pending-balance` - Pending balance information
- `POST /wallet/auth/*` - Wallet authentication
- `GET /wallet/transactions` - Transaction history

**Characteristics**:
- User-focused operations
- High-performance requirements
- Mobile-optimized responses
- Wallet-specific authentication

### 🔧 Common APIs (`/common`)
**Target Consumers**: Internal services, shared utilities

**Endpoints** (planned):
- Health checks
- System status
- Internal admin operations

**Characteristics**:
- Internal-only endpoints
- System administration
- Cross-cutting concerns

## BFF Benefits

### 1. **Tailored APIs**
Each consuming application gets an API designed specifically for its use case:
- Dashboard gets admin-focused endpoints with complex business logic
- Wallet gets user-focused endpoints optimized for performance
- External services get simple, public endpoints

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
│   Dashboard     │    │     Wallet      │    │   External      │
│   Frontend      │    │   Application   │    │   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Dashboard API  │    │   Wallet API    │    │  Shared API     │
│   (Package)     │    │   (Package)     │    │  (Package)      │
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
2. **Choose the appropriate API module**: Dashboard, Wallet, Shared, or Common
3. **Extract from domain**: Move HTTP concerns from domain to API layer
4. **Keep domain pure**: Domain should only contain business logic

### API Design Principles
- **Consumer-first**: Design APIs for the specific needs of each consumer
- **Consistent within module**: Each API module should have consistent patterns
- **Minimal coupling**: APIs should not depend on each other
- **Domain separation**: Keep HTTP concerns separate from business logic

## Migration Status

- ✅ **Shared API**: Airtable and common utilities extracted
- 🚧 **Dashboard API**: Business routes in progress
- ⏳ **Wallet API**: Planned
- ⏳ **Common API**: Planned

This architecture provides a solid foundation for scaling the backend as the ecosystem grows while maintaining clean separation of concerns and enabling independent evolution of each consumer application. 