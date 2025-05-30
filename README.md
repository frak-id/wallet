# Frak Wallet

Web3 infrastructure for seamless referral tracking and reward systems, enabling corporations to build mouth-to-mouth acquisition campaigns.

## Repository Scope

This monorepo contains the complete Frak ecosystem infrastructure, including wallets, SDKs, examples, and backend services. For additional resources:

- **Blockchain Indexing**: [frak-id/indexer](https://github.com/frak-id/indexer) - Ponder-based blockchain event indexing
- **RPC Infrastructure**: [frak-id/erpc](https://github.com/frak-id/erpc) - Load balancing and caching layer

## Documentation

Visit our comprehensive documentation at **[docs.frak.id](https://docs.frak.id)** for integration guides, API references, and examples.

## Project Structure

### 📱 Applications (`/apps`)
- **`wallet/`** - Main Frak Wallet interface for users
- **`dashboard/`** - Business dashboard for campaign management
- **`dashboard-admin/`** - Administrative interface

### 📦 Core Packages (`/packages`)
- **`shared/`** - Common utilities and types across the ecosystem
- **`app-essentials/`** - Essential components and utilities for applications
- **`browserslist-config/`** - Browser compatibility configuration

### 🛠️ SDK (`/sdk`)
- **`core/`** - Core SDK functionality and blockchain interactions
- **`react/`** - React-specific hooks and components
- **`components/`** - Reusable UI components for integrations
- **`legacy/`** - Legacy SDK components for backward compatibility

### 🌐 Backend Services (`/services`)
- **`backend/`** - Elysia.js-based API and business logic

### 🏗️ Infrastructure (`/infra`)
- **AWS & SST configurations** - Serverless deployment infrastructure
- **GCP integrations** - Google Cloud Platform services
- **Component definitions** - Reusable infrastructure components

### 📚 Examples (`/example`)
- **`vanilla-js/`** - Pure JavaScript integration examples
- **`wallet-ethcc/`** - Conference-specific wallet implementation
- **`components/`** - Component usage examples

### 📖 Documentation (`/docs`)
- Generated documentation and guides

## Technology Stack

### Frontend Stack
- **[Next.js](https://nextjs.org/)** - React framework with SSR
- **[TanStack Query](https://tanstack.com/)** - Data fetching and state management
- **[Wagmi](https://wagmi.sh/)** - Ethereum hooks for React
- **[Viem](https://viem.sh/)** - TypeScript interface for Ethereum

### Backend & Infrastructure
- **[Elysia.js](https://elysiajs.com/)** - Fast and type-safe backend framework
- **[SST](https://sst.dev/)** - Infrastructure as Code on AWS
- **[Pulumi](https://www.pulumi.com/)** - Cloud infrastructure management

### Blockchain Infrastructure
- **[Pimlico](https://www.pimlico.io/)** - Paymaster and bundler operations
- **[ZeroDev](https://zerodev.app/)** - Smart account solutions
- **[ERPC](https://www.erpc.cloud/)** - RPC load balancing and caching [Deployment repo](https://github.com/frak-id/infra-blockchain)
- **[Ponder](https://ponder.sh/)** - Blockchain event indexing [Deployment repo](https://github.com/frak-id/infra-blockchain)

### Development Tools
- **[Changesets](https://github.com/changesets/changesets)** - Package versioning and releases
- **[Typedoc](https://typedoc.org/)** - Documentation generation
- **[Knip](https://knip.dev/)** - Dead code elimination
- **[Biome](https://biomejs.dev/)** - Ultra-fast linting and formatting

## Quick Start

```bash
# Clone the repository
git clone https://github.com/frak-id/wallet.git
cd wallet

# Install dependencies
bun install

# Start development server
bun dev
```

## License

GNU GPLv3 License - see [LICENSE](LICENSE) for details.
