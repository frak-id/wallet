# Frak Wallet

Web3 referral tracking and rewards.

## Repository Scope

This monorepo holds the wallet apps, the SDKs, the backend services and the
infrastructure. Related repositories:

- **Blockchain Indexing**: [frak-id/indexer](https://github.com/frak-id/indexer) - Ponder-based blockchain event indexing
- **RPC Infrastructure**: [frak-id/erpc](https://github.com/frak-id/erpc) - Load balancing and caching layer

## Documentation

Integration guides and API references: **[docs.frak.id](https://docs.frak.id)**.

## Working in this repo

[`AGENTS.md`](./AGENTS.md) is the compass: quick commands, a "Where to Look" table
mapping tasks to directories, and the non-obvious rules that the tooling does not
enforce. Each app, package and service has its own `AGENTS.md` next to it.

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
