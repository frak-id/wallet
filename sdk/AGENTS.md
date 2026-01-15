# SDK Packages Context

## Package Architecture

```
@frak-labs/frame-connector (RPC foundation)
         |
@frak-labs/core-sdk (Core functionality)
         |              \
@frak-labs/react-sdk    @frak-labs/components
         |
@frak-labs/legacy (deprecated)
```

**Build Order:** `rpc -> core -> legacy -> react -> components`

## sdk/core/ - Core SDK

**Entry Points:**
- `index.ts` - Main exports
- `actions/index.ts` - Action methods
- `interactions/index.ts` - Interaction encoders
- `bundle.ts` - Combined bundle for CDN

**Build Outputs:**
- NPM: `dist/` (ESM + CJS + types)
- CDN: `cdn/bundle.js` (IIFE with global `FrakSDK`)

**Action Pattern:**
```typescript
async function sendInteraction(
  client: FrakClient,
  params: { productId: Hex; interaction: Interaction }
): Promise<SendInteractionReturnType> {
  return await client.request({
    method: "frak_sendInteraction",
    params: [params.productId, params.interaction],
  });
}
```

## sdk/react/ - React SDK

**Public API:**
- Providers: `FrakConfigProvider`, `FrakIFrameClientProvider`
- Hooks: `useWalletStatus()`, `useSendInteraction()`, `useDisplayModal()`

**Pattern (TanStack Query):**
```typescript
// Queries for reads
export function useWalletStatus(options?: UseQueryOptions) {
  const client = useFrakClient();
  return useQuery({
    queryKey: ["walletStatus"],
    queryFn: () => watchWalletStatus(client),
    ...options,
  });
}

// Mutations for writes
export function useSendInteraction(options?: UseMutationOptions) {
  const client = useFrakClient();
  return useMutation({
    mutationFn: (params) => sendInteraction(client, params),
    ...options,
  });
}
```

## sdk/components/ - Web Components

**Components:**
- `<frak-button-wallet>` - Wallet modal trigger
- `<frak-button-share>` - Share/referral button

**CDN Usage:**
```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@frak-labs/components" defer></script>
<script>
window.FrakSetup = { config: { metadata: { name: "My App" } } };
</script>
<frak-button-wallet></frak-button-wallet>
```

## Build System (tsdown)

**NPM Builds:**
```typescript
{ format: ["esm", "cjs"], outDir: "dist", dts: true }
```

**CDN Builds:**
```typescript
{ format: "iife", globalName: "FrakSDK", outDir: "cdn", noExternal: [/.*/] }
```

## Package Exports (Development Mode)

```json
"exports": {
  ".": {
    "development": "./src/index.ts",
    "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }
  }
}
```

Monorepo apps use source directly (faster dev), external consumers use built files.

## Adding New Action

1. Define types in `sdk/core/src/types/rpc/*.ts`
2. Add to `IFrameRpcSchema`
3. Implement in `sdk/core/src/actions/myAction.ts`
4. Export from `sdk/core/src/actions/index.ts`
5. Create React hook in `sdk/react/src/hook/useMyAction.ts`

## Commands

```bash
bun run build:sdk        # Build all SDKs
bun run test --project core-sdk-unit
bun run test --project react-sdk-unit
```
