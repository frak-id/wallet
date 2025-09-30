# @frak-labs/rpc Usage Guide

This package provides a **generic, type-safe RPC communication layer** for bidirectional postMessage-based communication. It's completely framework-agnostic and doesn't depend on any domain-specific types.

## Architecture

The RPC package is now a **pure generic utility**:
- Zero dependencies on domain-specific packages (like `@frak-labs/core-sdk`)
- Consumers provide their own schema type as a generic parameter
- Full type safety through TypeScript generics
- No circular dependencies

## Defining a Schema

First, define your RPC schema using the generic schema types:

```typescript
// In your SDK package (e.g., @frak-labs/core-sdk)
import type { RpcSchemaEntry } from '@frak-labs/rpc'
import type { Hex } from 'viem'

// Define your domain-specific types
export type WalletStatus =
  | { key: 'connected', wallet: Hex }
  | { key: 'connecting' }
  | { key: 'disconnected' }

export type SendInteractionParams = [
  productId: Hex,
  interaction: PreparedInteraction,
  signature?: Hex
]

export type SendInteractionResult = {
  status: 'success'
  hash: Hex
}

// Define your RPC schema
export type IFrameRpcSchema = [
  // Streaming method - emits multiple values
  {
    Method: 'frak_listenToWalletStatus'
    Parameters?: undefined
    ReturnType: WalletStatus
    ResponseType: 'stream'
  },
  // Promise method - one-shot request
  {
    Method: 'frak_sendInteraction'
    Parameters: SendInteractionParams
    ReturnType: SendInteractionResult
    ResponseType: 'promise'
  },
  // Add more methods...
]
```

## Client-Side Usage (SDK)

```typescript
import { createRpcClient } from '@frak-labs/rpc'
import type { IFrameRpcSchema } from '@frak-labs/core-sdk'

// Create a type-safe client
const client = createRpcClient<IFrameRpcSchema>({
  transport: window,
  targetOrigin: 'https://wallet.frak.id'
})

// Connect first
await client.connect()

// Make promise-based requests (fully typed)
const result = await client.request(
  'frak_sendInteraction',
  [productId, interaction, signature]
)
// result: SendInteractionResult

// Make streaming requests (fully typed)
for await (const status of client.stream('frak_listenToWalletStatus')) {
  console.log('Wallet status:', status)
  // status: WalletStatus
}

// Cleanup when done
client.cleanup()
```

## Server-Side Usage (Wallet)

```typescript
import { createRpcListener } from '@frak-labs/rpc'
import type { IFrameRpcSchema } from '@frak-labs/core-sdk'

// Create a type-safe listener
const listener = createRpcListener<IFrameRpcSchema>({
  transport: window,
  allowedOrigins: ['https://example.com', 'https://app.example.com']
})

// Register a promise handler (fully typed)
listener.handle('frak_sendInteraction', async (params, context) => {
  // params: SendInteractionParams - fully typed!
  const [productId, interaction, signature] = params

  // Process the interaction...
  await processInteraction(productId, interaction, signature)

  // Return must match ReturnType
  return { status: 'success', hash: '0x...' }
  // Return type: SendInteractionResult
})

// Register a stream handler (fully typed)
listener.handleStream('frak_listenToWalletStatus', (params, emit, context) => {
  // params: undefined (no parameters for this method)
  // emit: (chunk: WalletStatus) => void - fully typed!

  // Emit initial status
  emit({ key: 'connecting' })

  // Later, emit updates
  setTimeout(() => {
    emit({ key: 'connected', wallet: '0x...' })
  }, 1000)
})

// Cleanup when done
listener.cleanup()
```

## Type Safety Benefits

### Method Names
```typescript
// ✅ Valid - method exists in schema
client.request('frak_sendInteraction', [productId, interaction])

// ❌ TypeScript error - method doesn't exist
client.request('invalid_method', [])
```

### Parameters
```typescript
// ✅ Valid - correct parameters
client.request('frak_sendInteraction', [productId, interaction, signature])

// ❌ TypeScript error - missing required parameters
client.request('frak_sendInteraction')

// ❌ TypeScript error - wrong parameter types
client.request('frak_sendInteraction', ['invalid'])
```

### Return Types
```typescript
// ✅ Fully typed return value
const result = await client.request('frak_sendInteraction', [...])
// result.status - TypeScript knows this is 'success'
// result.hash - TypeScript knows this is Hex

// ✅ Stream values are typed
for await (const status of client.stream('frak_listenToWalletStatus')) {
  // status.key - TypeScript knows: 'connected' | 'connecting' | 'disconnected'
  if (status.key === 'connected') {
    // status.wallet - TypeScript knows this exists and is Hex
  }
}
```

### Handler Types
```typescript
// ✅ Handler parameters and return types are inferred
listener.handle('frak_sendInteraction', async (params, context) => {
  // params is automatically typed as SendInteractionParams
  // Return type must be SendInteractionResult

  // ❌ TypeScript error - wrong return type
  return { invalid: 'data' }
})
```

## Migration Guide

### For SDK Consumers

**Before:**
```typescript
import { createRpcClient } from '@frak-labs/rpc'

const client = createRpcClient({ ... })
```

**After:**
```typescript
import { createRpcClient } from '@frak-labs/rpc'
import type { IFrameRpcSchema } from '@frak-labs/core-sdk'

const client = createRpcClient<IFrameRpcSchema>({ ... })
```

### For Wallet/Listener Consumers

**Before:**
```typescript
import { createRpcListener } from '@frak-labs/rpc'

const listener = createRpcListener({ ... })
```

**After:**
```typescript
import { createRpcListener } from '@frak-labs/rpc'
import type { IFrameRpcSchema } from '@frak-labs/core-sdk'

const listener = createRpcListener<IFrameRpcSchema>({ ... })
```

## Benefits of This Approach

1. **No Circular Dependencies**: The RPC package is a pure utility with zero dependencies
2. **Complete Type Safety**: All types flow from the schema through generics
3. **Framework Agnostic**: Works with any RPC schema, not just Frak's
4. **Reusable**: Can be used in other projects with different schemas
5. **Better Tree Shaking**: Consumers only import what they need
6. **Clearer Architecture**: Schema definitions live with domain logic, not infrastructure

## Advanced Usage

### Custom Schema

You can use this package with any custom schema:

```typescript
import { createRpcClient, createRpcListener } from '@frak-labs/rpc'
import type { RpcSchema } from '@frak-labs/rpc'

// Define your own schema
type MyCustomSchema = [
  {
    Method: 'greet'
    Parameters: [name: string]
    ReturnType: { message: string }
    ResponseType: 'promise'
  },
  {
    Method: 'watchTime'
    Parameters?: undefined
    ReturnType: number
    ResponseType: 'stream'
  }
]

// Use it!
const client = createRpcClient<MyCustomSchema>({ ... })
const listener = createRpcListener<MyCustomSchema>({ ... })
```

### Type Utilities

The package exports useful type utilities:

```typescript
import type {
  ExtractMethod,
  ExtractParams,
  ExtractReturnType,
  ExtractMethodsByKind
} from '@frak-labs/rpc'

// Extract all method names
type Methods = ExtractMethod<MySchema>
// 'greet' | 'watchTime'

// Extract promise-only methods
type PromiseMethods = ExtractMethodsByKind<MySchema, 'promise'>
// 'greet'

// Extract stream-only methods
type StreamMethods = ExtractMethodsByKind<MySchema, 'stream'>
// 'watchTime'

// Extract params for a method
type GreetParams = ExtractParams<MySchema, 'greet'>
// [name: string]

// Extract return type for a method
type GreetReturn = ExtractReturnType<MySchema, 'greet'>
// { message: string }
```
