# RPC Package Refactoring Summary

## Problem Solved

**Circular Dependency Eliminated**: The `packages/rpc` package previously had a circular dependency with `@frak-labs/core-sdk`:
- `packages/rpc` imported types from `@frak-labs/core-sdk` (for the RPC schema)
- `@frak-labs/core-sdk` needed to import from `packages/rpc` (for transport utilities)
- This created a circular dependency that could break the build

## Solution

Made `packages/rpc` **completely generic** over the RPC schema type. The package is now a pure, generic utility with **zero dependencies** on domain-specific packages.

## Files Modified

### 1. `/packages/rpc/src/rpc-schema.ts` - Generic Schema Types
**Before**: Imported concrete types from `@frak-labs/core-sdk`
**After**: Defines only the **structure/shape** of an RPC schema using generic types

```typescript
// Generic shape of an RPC schema entry
export type RpcSchemaEntry<
    TMethod extends string = string,
    TParams = unknown,
    TReturn = unknown,
    TResponseKind extends RpcResponseKind = RpcResponseKind,
> = {
    Method: TMethod
    Parameters?: TParams
    ReturnType: TReturn
    ResponseType: TResponseKind
}

// An RPC schema is an array of entries
export type RpcSchema = ReadonlyArray<RpcSchemaEntry>

// Type utilities that work on any schema
export type ExtractMethod<TSchema extends RpcSchema> = ...
export type ExtractParams<TSchema extends RpcSchema, TMethod> = ...
export type ExtractReturnType<TSchema extends RpcSchema, TMethod> = ...
export type ExtractMethodsByKind<TSchema extends RpcSchema, TResponseKind> = ...
```

### 2. `/packages/rpc/src/types.ts` - Generic Handler Types
**Before**: Handler types were tied to specific schema
**After**: Handler types are generic over schema

```typescript
export type RpcPromiseHandler<
    TSchema extends RpcSchema,
    TMethod extends ExtractMethod<TSchema>,
> = (
    params: ExtractParams<TSchema, TMethod>,
    context: RpcRequestContext
) => Promise<ExtractReturnType<TSchema, TMethod>>

export type RpcStreamHandler<
    TSchema extends RpcSchema,
    TMethod extends ExtractMethod<TSchema>,
> = (
    params: ExtractParams<TSchema, TMethod>,
    emitter: StreamEmitter<ExtractReturnType<TSchema, TMethod>>,
    context: RpcRequestContext
) => Promise<void> | void
```

### 3. `/packages/rpc/src/client.ts` - Generic Client
**Before**: `createRpcClient()` without schema type parameter
**After**: `createRpcClient<TSchema extends RpcSchema>()`

```typescript
export function createRpcClient<TSchema extends RpcSchema>(
    config: RpcClientConfig
): RpcClient<TSchema> {
    // All type inference flows from TSchema
}
```

### 4. `/packages/rpc/src/listener.ts` - Generic Listener
**Before**: `createRpcListener()` without schema type parameter
**After**: `createRpcListener<TSchema extends RpcSchema>()`

```typescript
export function createRpcListener<TSchema extends RpcSchema>(
    config: RpcListenerConfig
): RpcListener<TSchema> {
    // All type inference flows from TSchema
}
```

### 5. `/packages/rpc/package.json` - Dependencies Removed
**Before**:
```json
{
  "dependencies": {
    "@frak-labs/core-sdk": "workspace:*",
    "viem": "^2.31.2"
  }
}
```

**After**:
```json
{
  "dependencies": {}
}
```

### 6. `/sdk/core/src/types/rpc.ts` - Schema Definition with ResponseType
**Before**: Schema entries without `ResponseType` field
**After**: Added `ResponseType: "promise" | "stream"` to each entry

```typescript
export type IFrameRpcSchema = [
    {
        Method: "frak_listenToWalletStatus"
        Parameters?: undefined
        ReturnType: WalletStatusReturnType
        ResponseType: "stream"  // <-- Added
    },
    {
        Method: "frak_sendInteraction"
        Parameters: [productId: Hex, interaction: PreparedInteraction, signature?: Hex]
        ReturnType: SendInteractionReturnType
        ResponseType: "promise"  // <-- Added
    },
    // ...
]
```

### 7. SDK Core Client - Generic Type Parameter
**File**: `/sdk/core/src/clients/createIFrameFrakClient.ts`
**Before**: `const rpcClient = createRpcClient({ ... })`
**After**: `const rpcClient = createRpcClient<IFrameRpcSchema>({ ... })`

### 8. Wallet App Listener - Generic Type Parameter
**File**: `/apps/wallet/app/views/listener.tsx`
**Before**: `const listener = createRpcListener({ ... })`
**After**: `const listener = createRpcListener<IFrameRpcSchema>({ ... })`

### 9. Wallet Hook Type Definitions - Updated Handler Types
**Files Modified** (all in `/apps/wallet/app/module/listener/hooks/`):
- `useSendInteractionListener.ts`
- `useWalletStatusListener.ts`
- `useOnGetProductInformation.ts`
- `useDisplayEmbeddedWallet.ts`
- `useDisplayModalListener.ts`
- `useOnOpenSso.ts`
- `useOnTrackSso.ts`

**Before**: `type Handler = PromiseHandler<"method">`
**After**: `type Handler = RpcPromiseHandler<IFrameRpcSchema, "method">`

**Before**: `type Handler = StreamHandler<"method">`
**After**: `type Handler = RpcStreamHandler<IFrameRpcSchema, "method">`

## How the Circular Dependency Was Eliminated

### Before (Circular):
```
@frak-labs/rpc
    ↓ (imports schema types)
@frak-labs/core-sdk
    ↓ (imports RPC utilities)
@frak-labs/rpc  ← CIRCULAR!
```

### After (Linear):
```
@frak-labs/rpc (generic, zero dependencies)
    ↑ (imports generic types)
@frak-labs/core-sdk (defines IFrameRpcSchema)
    ↑ (imports both)
SDK/Wallet Apps (use with schema type parameter)
```

## Usage Examples

### SDK Client Side
```typescript
import { createRpcClient } from '@frak-labs/rpc'
import type { IFrameRpcSchema } from '@frak-labs/core-sdk'

const client = createRpcClient<IFrameRpcSchema>({
  transport: window,
  targetOrigin: 'https://wallet.frak.id'
})

await client.connect()

// Fully typed request
const result = await client.request('frak_sendInteraction', [productId, interaction])

// Fully typed streaming
for await (const status of client.stream('frak_listenToWalletStatus')) {
  console.log(status) // TypeScript knows the exact type
}
```

### Wallet Listener Side
```typescript
import { createRpcListener } from '@frak-labs/rpc'
import type { IFrameRpcSchema } from '@frak-labs/core-sdk'

const listener = createRpcListener<IFrameRpcSchema>({
  transport: window,
  allowedOrigins: '*'
})

// Fully typed promise handler
listener.handle('frak_sendInteraction', async (params, context) => {
  // params is automatically typed as [productId: Hex, interaction: PreparedInteraction, signature?: Hex]
  return { delegationId: '...' }
})

// Fully typed stream handler
listener.handleStream('frak_listenToWalletStatus', (params, emit, context) => {
  // emit is typed as (chunk: WalletStatusReturnType) => void
  emit({ key: 'connected', wallet: '0x...' })
})
```

## TypeScript Compilation Verification

```bash
bun run typecheck
```

**Result**: ✅ All packages pass type checking with zero errors

**Packages verified**:
- `@frak-labs/rpc` - Compiles successfully with zero dependencies
- `@frak-labs/core-sdk` - Compiles successfully
- `@frak-labs/react-sdk` - Compiles successfully
- `@frak-labs/components` - Compiles successfully
- `@frak-labs/nexus-wallet` - Compiles successfully
- All example apps - Compile successfully

## Benefits

1. **No Circular Dependencies**: Clean, linear dependency graph
2. **Complete Type Safety**: All types flow from the schema through generics
3. **Framework Agnostic**: RPC package is a pure utility, can be reused anywhere
4. **Better Tree Shaking**: Consumers only import what they need
5. **Clearer Architecture**: Schema definitions live with domain logic, not infrastructure
6. **Reusable**: Can be used in other projects with different schemas
7. **Zero Runtime Overhead**: All generic types are compile-time only

## Migration Guide for Consumers

### Old Usage
```typescript
import { createRpcClient } from '@frak-labs/rpc'

const client = createRpcClient({ ... })
```

### New Usage
```typescript
import { createRpcClient } from '@frak-labs/rpc'
import type { IFrameRpcSchema } from '@frak-labs/core-sdk'

const client = createRpcClient<IFrameRpcSchema>({ ... })
```

**Only Change Required**: Add the schema type parameter `<IFrameRpcSchema>` when creating clients or listeners.

## Documentation

See `USAGE.md` for comprehensive usage examples and migration guide.
