---
"@frak-labs/core-sdk": major
"@frak-labs/react-sdk": major
"@frak-labs/components": major
---

Replace `config.walletUrl` with `config.env`, which states both origins.

The backend URL used to be guessed from the wallet URL by substring-matching a
short list of known hosts, so pointing at anything else (a sandbox, a tunnel, a
second local port) silently sent every API call to production. `env` states both
origins instead, either by naming a stage or by giving the pair outright:

```ts
// before
{ walletUrl: "https://wallet-dev.frak.id" }

// after
{ env: "dev" }

// local, or any host the presets don't know
{ env: { wallet: "https://localhost:3000", backend: "https://localhost:3030" } }
```

`env` defaults to `"prod"`, so integrations that never set `walletUrl` need no
change. Anything that did set it must move to `env`.

The resolved pair is published at setup and read back from a page-level
singleton, so `getBackendUrl()` no longer takes a wallet URL, and neither do
`ensureIdentity`, `sdkConfigStore.resolve` or `sdkConfigStore.resolveMerchantId`.
It also replaces the `process.env.BACKEND_URL` build-time define — the published
bundles are no longer stage-baked.

Because it is page-level, `env` is the one config field that is not scoped to a
single client or React provider: the last integration to state one wins, and
doing so logs a warning. A config that omits `env` leaves the published value
alone rather than resetting it to production.

An `env` that names an unknown stage, or an object missing either origin, is
reported with `console.error` and falls back to production instead of being
absorbed silently — most integrations state it from untyped ground (a template,
a pasted snippet, `window.FrakSetup.config`). Trailing slashes are stripped.

New exports: the `FrakEnvironment` type, plus `setEnvironment` /
`getEnvironment` for reading or overriding the active pair.
