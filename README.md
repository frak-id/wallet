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
- **`wallet/`** - React Router v7 user wallet (SSR disabled, module-based architecture)
- **`business/`** - TanStack Start business dashboard (SSR enabled, primary dashboard)
- **`dashboard/`** - Next.js 15 business dashboard (standalone output, legacy)
- **`dashboard-admin/`** - React Router admin interface
- **`listener/`** - Iframe communication app for SDK interactions

### 📦 Core Packages (`/packages`)
- **`wallet-shared/`** - Shared code exclusively for wallet and listener apps
- **`ui/`** - Radix UI-based component library (generic, reusable across all apps)
- **`app-essentials/`** - Core blockchain utilities and WebAuthn configuration
- **`client/`** - API client abstractions (Elysia Eden Treaty integration)
- **`dev-tooling/`** - Build configurations (manualChunks, onwarn suppressions)
- **`rpc/`** - RPC utilities (published as `@frak-labs/frame-connector`)

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
- **[React Router v7](https://reactrouter.com/)** - React framework for wallet and admin apps
- **[TanStack Start](https://tanstack.com/start)** - Full-stack React framework for business dashboard
- **[Next.js 15](https://nextjs.org/)** - React framework with SSR (legacy dashboard only)
- **[TanStack Query](https://tanstack.com/query)** - Data fetching and state management
- **[Wagmi](https://wagmi.sh/)** - Ethereum hooks for React
- **[Viem](https://viem.sh/)** - TypeScript interface for Ethereum
- **[Zustand](https://zustand-demo.pmnd.rs/)** - Global state management across all frontend apps

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
