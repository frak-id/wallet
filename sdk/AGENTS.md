# sdk/ — Compass

Public SDK surface. Dual output (NPM `dist/` + CDN `cdn/`). Build order is **strict**: `rpc → core → legacy → react → components`. Linked via Changesets: `frame-connector`, `core-sdk`, `react-sdk`.

## Package Graph
```
@frak-labs/frame-connector (packages/rpc) ─── RPC foundation
           │
@frak-labs/core-sdk         ─── actions, clients, bundle
           │              ╲
@frak-labs/react-sdk      @frak-labs/components (Preact, Web Components)
           │
@frak-labs/nexus-sdk (legacy, Knip-ignored, IIFE as NexusSDK)
```

## Build System (tsdown / Rolldown)
- **NPM**: `{ format: ["esm", "cjs"], outDir: "dist", dts: true }`
- **CDN**: `{ format: "iife", globalName: "FrakSDK", outDir: "cdn", noExternal: [/.*/] }` — fully self-contained bundle
- **`development` export condition**: apps in this monorepo consume `src/index.ts` directly (no rebuild in dev loop)

## Non-Obvious Patterns
- **Build order is a hard requirement** — downstream packages typecheck against upstream build outputs.
- **CDN `noExternal: [/.*/]`** means every dep (viem, TanStack Query, etc.) ships inside the bundle. Size discipline matters.
- **Adding a new action is a 4-step sequence** (do not skip):
  1. Add type in `sdk/core/src/types/rpc/*.ts`, extend `IFrameRpcSchema`
  2. Implement in `sdk/core/src/actions/<name>.ts` (pure function, `client: FrakClient`)
  3. Re-export from `sdk/core/src/actions/index.ts`
  4. Add React hook in `sdk/react/src/hook/use<Name>.ts` (wrap with TanStack Query)
- **Action pattern**: `client.request({ method, params })` — never call transports directly.
- **Hook pattern**: `useFrakClient()` + `useQuery`/`useMutation` — never recreate clients.
- **Legacy is Knip-ignored** — do not add new exports there.

## Quick Commands
```bash
bun run build:sdk                       # Builds all SDKs in the correct order
bun run test --project core-sdk-unit
bun run test --project react-sdk-unit
```

## See Also
Children `sdk/{core,react,components}/AGENTS.md` · `packages/rpc/` (frame-connector source) · `apps/listener/AGENTS.md` (RPC consumer).
