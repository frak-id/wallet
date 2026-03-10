# SDK Packages Context

## Package Architecture

```
@frak-labs/frame-connector (RPC foundation)
         |
@frak-labs/core-sdk (Core functionality)
         |              \
@frak-labs/react-sdk    @frak-labs/components
         |
@frak-labs/legacy (deprecated, ignored by Knip)
```

**Build Order:** `rpc -> core -> legacy -> react -> components`
**Linked Packages (Changesets):** `frame-connector`, `core-sdk`, `react-sdk`

## Build System (tsdown)

Uses array configs for dual output (NPM + CDN).

**NPM Builds:** `dist/` (ESM + CJS + types)
```typescript
{ format: ["esm", "cjs"], outDir: "dist", dts: true }
```

**CDN Builds:** `cdn/` (IIFE/ESM, fully bundled)
```typescript
{ format: "iife", globalName: "FrakSDK", outDir: "cdn", noExternal: [/.*/] }
```

**Development Exports:** Monorepo apps use source directly via `"development"` condition.
```json
"exports": {
  ".": {
    "development": "./src/index.ts",
    "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }
  }
}
```

## Patterns

**Action Pattern (Core):**
```typescript
async function sendInteraction(client: FrakClient, params: Params): Promise<Result> {
  return await client.request({ method: "frak_sendInteraction", params: [params.id, params.data] });
}
```

**Hook Pattern (React):**
```typescript
export function useWalletStatus(options?: UseQueryOptions) {
  const client = useFrakClient();
  return useQuery({ queryKey: ["walletStatus"], queryFn: () => watchWalletStatus(client), ...options });
}
```

## Adding New Action

1. Define types in `sdk/core/src/types/rpc/*.ts` and add to `IFrameRpcSchema`.
2. Implement in `sdk/core/src/actions/myAction.ts`.
3. Export from `sdk/core/src/actions/index.ts`.
4. Create React hook in `sdk/react/src/hook/useMyAction.ts`.

## Commands

```bash
bun run build:sdk        # Build all SDKs sequentially
bun run test --project core-sdk-unit
bun run test --project react-sdk-unit
```
