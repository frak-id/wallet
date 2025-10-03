# @frak-labs/frame-connector

Modern, type-safe RPC communication layer for cross-window postMessage communication.

## Overview

This package provides a robust RPC system for communication between the Frak Wallet and SDK clients. It maintains 100% backward compatibility with the existing message format while providing a modern API with promises and async iterators.

## Features

- **Type-safe**: Full TypeScript support with schema-based typing
- **Backward compatible**: Uses the existing `{ id, topic, data }` message format
- **Modern API**: Promises for one-shot requests, async iterators for streams
- **Functional**: No classes, just pure functions
- **Secure**: Origin validation and error handling built-in
- **Framework-agnostic**: Works with any transport mechanism

## Architecture

### Message Format (Unchanged)

Messages maintain the exact same format for backward compatibility:

```typescript
{
  id: string      // Unique request identifier
  topic: string   // Method name (e.g., 'frak_sendInteraction')
  data: unknown   // Request parameters or response data
}
```

### Response Types

Each RPC method in the schema is annotated with a `ResponseType`:

- `"promise"`: One-shot request that resolves once (e.g., `frak_sendInteraction`)
- `"stream"`: Streaming request that can emit multiple values (e.g., `frak_listenToWalletStatus`)

## Usage

### Client-Side (SDK)

```typescript
import { createRpcClient } from '@frak-labs/frame-connector'

// Create the client
const client = createRpcClient({
  transport: window,
  targetOrigin: 'https://wallet.frak.id'
})

// Connect before making requests
await client.connect()

// One-shot request (promise-based)
const result = await client.request(
  'frak_sendInteraction',
  productId,
  interaction,
  signature
)

// Streaming request (async iterator)
for await (const status of client.stream('frak_listenToWalletStatus')) {
  console.log('Wallet status:', status)

  if (status.key === 'connected') {
    console.log('Connected to wallet:', status.wallet)
  }
}

// Cleanup when done
client.cleanup()
```

### Wallet-Side (Listener)

```typescript
import { createRpcListener } from '@frak-labs/frame-connector'

// Create the listener
const listener = createRpcListener({
  transport: window,
  allowedOrigins: ['https://example.com', 'https://app.example.com']
})

// Register a promise handler (one-shot)
listener.handle('frak_sendInteraction', async (params, context) => {
  const [productId, interaction, signature] = params

  // Process the interaction
  const hash = await processInteraction(productId, interaction, signature)

  return {
    status: 'success',
    hash
  }
})

// Register a stream handler (multiple emissions)
listener.handleStream('frak_listenToWalletStatus', (params, emit, context) => {
  // Emit initial status
  emit({ key: 'connecting' })

  // Set up listener for wallet changes
  const unsubscribe = walletState.subscribe((state) => {
    if (state.connected) {
      emit({ key: 'connected', wallet: state.address })
    } else {
      emit({ key: 'not-connected' })
    }
  })

  // Return cleanup function (optional)
  return () => unsubscribe()
})

// Cleanup when done
listener.cleanup()
```

## API Reference

### Client

#### `createRpcClient(config: RpcClientConfig): RpcClient`

Creates an RPC client for SDK-side communication.

**Config:**
- `transport: RpcTransport` - The transport mechanism (e.g., `window`)
- `targetOrigin: string` - Target origin for postMessage
- `handshake?: HandshakeConfig` - Optional handshake configuration

**Returns:**
- `connect(): Promise<void>` - Establish connection
- `request(method, ...params): Promise<T>` - Make one-shot request
- `stream(method, ...params): AsyncIterableIterator<T>` - Make streaming request
- `getState(): ConnectionState` - Get current connection state
- `cleanup(): void` - Clean up resources

### Listener

#### `createRpcListener(config: RpcListenerConfig): RpcListener`

Creates an RPC listener for Wallet-side communication.

**Config:**
- `transport: RpcTransport` - The transport mechanism (e.g., `window`)
- `allowedOrigins: string | string[]` - Allowed origins for security

**Returns:**
- `handle(method, handler): void` - Register promise handler
- `handleStream(method, handler): void` - Register stream handler
- `unregister(method): void` - Unregister a handler
- `cleanup(): void` - Clean up resources

## Type Safety

The package provides full type safety through the RPC schema:

```typescript
// Method names are type-checked
client.request('frak_sendInteraction', ...)  // ✓ Valid
client.request('invalid_method', ...)        // ✗ Type error

// Parameters are type-checked
client.request('frak_sendInteraction', productId, interaction)  // ✓ Valid
client.request('frak_sendInteraction', 'wrong-params')          // ✗ Type error

// Return types are inferred
const result = await client.request('frak_sendInteraction', ...)
// result is typed as SendInteractionReturnType
```

## Error Handling

Errors are thrown as `FrakRpcError` with standard error codes:

```typescript
import { RpcErrorCodes } from '@frak-labs/frame-connector'

try {
  const result = await client.request('frak_sendInteraction', ...)
} catch (error) {
  if (error.code === RpcErrorCodes.userRejected) {
    console.log('User rejected the request')
  } else if (error.code === RpcErrorCodes.invalidParams) {
    console.error('Invalid parameters:', error.message)
  }
}
```

## Development

This package is part of the Frak Wallet monorepo and uses Bun as the package manager.

```bash
# Install dependencies (from repo root)
bun install

# Type check
bun run typecheck

# Format
bun run format
```

## Migration Guide

For existing code using the old callback-based API, migration to the new API is straightforward:

### Before (callback-based):

```typescript
// Old SDK client
await transport.listenerRequest(
  { method: 'frak_listenToWalletStatus' },
  (status) => {
    console.log('Status:', status)
  }
)
```

### After (async iterator):

```typescript
// New RPC client
for await (const status of client.stream('frak_listenToWalletStatus')) {
  console.log('Status:', status)
}
```

The underlying message format remains unchanged, ensuring 100% backward compatibility.
