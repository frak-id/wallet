---
"@frak-labs/core-sdk": major
"@frak-labs/react-sdk": major
"@frak-labs/components": major
---

Replace `config.walletUrl` with `config.env`, which states both the wallet and backend origins instead of guessing the backend from the wallet URL by substring-matching known hosts.

```ts
// before
{ walletUrl: "https://wallet-dev.frak.id" }

// after
{ env: "dev" }

// local, or any host the presets don't know
{ env: { wallet: "https://localhost:3000", backend: "https://localhost:3030" } }
```

`env` defaults to `"prod"`, so integrations that never set `walletUrl` need no change. Anything that did must move to `env`.

`env` is page-level, not scoped to a single client or provider: the last integration to set one wins, and doing so logs a warning. Omitting `env` leaves the published value as is.

An unknown stage name, or an object missing either origin, is reported with `console.error` and falls back to production rather than failing silently. Trailing slashes are stripped.

New exports: the `FrakEnvironment` type, plus `setEnvironment` / `getEnvironment`.
