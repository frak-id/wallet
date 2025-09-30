# RPC Middleware System

The RPC middleware system allows you to augment request context, validate requests, transform responses, and add cross-cutting concerns like logging and compression without modifying individual handlers.

## Overview

Middleware functions intercept RPC messages at two points:
- **`onRequest`**: Before the handler executes (context augmentation, validation)
- **`onResponse`**: After the handler executes (response transformation, logging)

Middleware executes in order, forming a pipeline where each middleware can:
1. Read and modify the context (onRequest)
2. Validate and reject requests by throwing errors (onRequest)
3. Transform responses (onResponse)
4. Log, monitor, or perform side effects

## Core Concepts

### Context Augmentation

The primary use case for middleware is augmenting the base `RpcRequestContext` with domain-specific fields:

```typescript
// Base context only has origin and source
type RpcRequestContext = {
  origin: string
  source: MessageEventSource | null
}

// Your custom context type
type WalletContext = {
  productId: string
  sourceUrl: string
  isAutoContext: boolean
  walletReferrer?: string
}

// Middleware augments context
const contextMiddleware: RpcMiddleware<MySchema, WalletContext> = {
  onRequest: async (message, context) => {
    // Read from store/database
    const productId = await getProductIdFromOrigin(context.origin)
    const sourceUrl = await getSourceUrl(context.origin)

    return {
      ...context,
      productId,
      sourceUrl,
      isAutoContext: true
    }
  }
}

// Now handlers receive the augmented context
listener.handle('frak_sendInteraction', async (params, context) => {
  // context has all fields: origin, source, productId, sourceUrl, isAutoContext
  console.log(context.productId) // Type-safe!
})
```

### Type Safety

The middleware system is fully type-safe. The context type flows through generics:

```typescript
type MyContext = { userId: string, role: 'admin' | 'user' }

// Listener is generic over context type
const listener = createRpcListener<MySchema, MyContext>({
  transport: window,
  allowedOrigins: ['*'],
  middleware: [contextMiddleware] // Must return MyContext
})

// Handlers receive augmented context
listener.handle('someMethod', async (params, context) => {
  context.userId  // ✅ string
  context.role    // ✅ 'admin' | 'user'
  context.origin  // ✅ string (from base RpcRequestContext)
})
```

## Built-in Middleware

### Logging Middleware

Logs requests and responses for debugging and monitoring:

```typescript
import { createLoggingMiddleware } from '@frak-labs/rpc'

const listener = createRpcListener({
  transport: window,
  allowedOrigins: ['https://example.com'],
  middleware: [
    createLoggingMiddleware({
      logLevel: 'info',
      logParams: true,    // Include request params
      logResponse: false, // Exclude response data (for security)
      prefix: '[Wallet RPC]'
    })
  ]
})
```

Output:
```
[Wallet RPC] Request: frak_sendInteraction from https://example.com [id: abc123]
  Params: [...]
[Wallet RPC] Response: frak_sendInteraction to https://example.com [id: abc123]
```

### Compression Middleware

Handles automatic compression/decompression of large payloads:

```typescript
import { createCompressionMiddleware } from '@frak-labs/rpc'

const listener = createRpcListener({
  transport: window,
  allowedOrigins: ['https://example.com'],
  middleware: [
    createCompressionMiddleware({
      threshold: 2048,      // Only compress responses > 2KB
      algorithm: 'gzip'     // 'gzip' or 'deflate'
    })
  ]
})
```

**How it works:**
- `onRequest`: Detects and decompresses compressed request data
- `onResponse`: Compresses response data if it exceeds the threshold
- Uses browser's native `CompressionStream` API

**Important:** Place compression middleware **early** in the stack so subsequent middleware works with decompressed data.

## Creating Custom Middleware

### Basic Middleware

```typescript
import type { RpcMiddleware } from '@frak-labs/rpc'

const timingMiddleware: RpcMiddleware<MySchema> = {
  onRequest: (message, context) => {
    // Store start time in context (if needed)
    return { ...context, startTime: Date.now() }
  },

  onResponse: (message, response, context) => {
    const duration = Date.now() - context.startTime
    console.log(`${message.topic} took ${duration}ms`)
    return response
  }
}
```

### Context Augmentation Middleware

This is the most common pattern for wallet integration:

```typescript
type WalletContext = {
  productId: string
  sourceUrl: string
  isAutoContext: boolean
}

const walletContextMiddleware: RpcMiddleware<IFrameRpcSchema, WalletContext> = {
  onRequest: async (message, context) => {
    // Read from Jotai store or database
    const store = getStore()
    const iframeState = await store.get(iframeStateAtom)

    // Find iframe by origin
    const iframe = iframeState.find(i => i.origin === context.origin)

    if (!iframe) {
      throw new FrakRpcError(
        RpcErrorCodes.invalidRequest,
        'Unknown iframe origin'
      )
    }

    // Augment context with wallet-specific data
    return {
      ...context,
      productId: iframe.productId,
      sourceUrl: iframe.sourceUrl,
      isAutoContext: iframe.isAutoContext,
      walletReferrer: iframe.walletReferrer
    }
  }
}

// Now all handlers have access to these fields
const listener = createRpcListener<IFrameRpcSchema, WalletContext>({
  transport: window,
  allowedOrigins: ['*'],
  middleware: [walletContextMiddleware]
})

listener.handle('frak_sendInteraction', async (params, context) => {
  // No need to read from store - context already has everything!
  const { productId, sourceUrl, isAutoContext } = context
  // ...
})
```

### Validation Middleware

Reject requests based on custom logic:

```typescript
const validationMiddleware: RpcMiddleware<MySchema, MyContext> = {
  onRequest: async (message, context) => {
    // Validate productId matches expected value
    const expectedProductId = getExpectedProductId(message.topic)

    if (context.productId !== expectedProductId) {
      throw new FrakRpcError(
        RpcErrorCodes.invalidParams,
        `Invalid productId: expected ${expectedProductId}, got ${context.productId}`
      )
    }

    return context
  }
}
```

### Response Transformation Middleware

Transform responses before sending:

```typescript
const encryptionMiddleware: RpcMiddleware<MySchema> = {
  onResponse: async (message, response) => {
    if (response.error) {
      return response // Don't encrypt errors
    }

    // Encrypt the result
    const encrypted = await encrypt(response.result)

    return { result: encrypted }
  }
}
```

## Middleware Composition

Middleware executes in order. Each middleware's output becomes the next middleware's input:

```typescript
const listener = createRpcListener<MySchema, MyContext>({
  transport: window,
  allowedOrigins: ['*'],
  middleware: [
    // 1. Decompress first (if needed)
    compressionMiddleware,

    // 2. Augment context with domain data
    contextAugmentationMiddleware,

    // 3. Validate the augmented context
    validationMiddleware,

    // 4. Log after all processing
    loggingMiddleware
  ]
})
```

**Execution order:**
1. `onRequest` hooks execute **top to bottom**
2. Handler executes with final augmented context
3. `onResponse` hooks execute **top to bottom**

## Error Handling

### Rejecting Requests

Throw an error in `onRequest` to reject the request:

```typescript
const authMiddleware: RpcMiddleware<MySchema> = {
  onRequest: (message, context) => {
    if (!isAuthenticated(context.origin)) {
      throw new FrakRpcError(
        RpcErrorCodes.userRejected,
        'User not authenticated'
      )
    }
    return context
  }
}
```

The error will be caught and sent as an RPC error response:
```json
{
  "error": {
    "code": -32003,
    "message": "User not authenticated"
  }
}
```

### Handling Middleware Errors

If middleware throws in `onResponse`, an error response is sent instead of the original response:

```typescript
const failingMiddleware: RpcMiddleware<MySchema> = {
  onResponse: (message, response) => {
    throw new Error('Something went wrong')
  }
}
```

Result: Error response sent to client instead of success.

### Stream Error Handling

For streaming methods, `onResponse` errors **don't fail the entire stream**. Instead, the chunk is skipped and an error is logged:

```typescript
listener.handleStream('someStream', (params, emit, context) => {
  emit(chunk1) // ✅ Sent
  emit(chunk2) // ❌ onResponse throws - chunk skipped, error logged
  emit(chunk3) // ✅ Sent (stream continues)
})
```

## Performance Considerations

1. **Middleware runs once per request**, not per emit (for streams)
2. **Async middleware** is awaited - avoid slow operations in onRequest
3. **Context augmentation** happens before handler execution - safe to cache data here
4. **Response transformation** happens after handler - ideal for compression/encryption
5. **Keep middleware focused** - each middleware should do one thing well

## Migration Guide (for Wallet Developers)

### Before (manual context reading)

```typescript
listener.handle('frak_sendInteraction', async (params, context) => {
  // Every handler reads from store manually
  const store = getStore()
  const iframeState = await store.get(iframeStateAtom)
  const iframe = iframeState.find(i => i.origin === context.origin)

  const productId = iframe.productId
  const sourceUrl = iframe.sourceUrl
  // ...
})
```

### After (middleware context augmentation)

```typescript
// Define context type once
type WalletContext = {
  productId: string
  sourceUrl: string
  isAutoContext: boolean
}

// Create middleware once
const walletContextMiddleware: RpcMiddleware<IFrameRpcSchema, WalletContext> = {
  onRequest: async (message, context) => {
    const store = getStore()
    const iframeState = await store.get(iframeStateAtom)
    const iframe = iframeState.find(i => i.origin === context.origin)

    return {
      ...context,
      productId: iframe.productId,
      sourceUrl: iframe.sourceUrl,
      isAutoContext: iframe.isAutoContext
    }
  }
}

// Use in listener
const listener = createRpcListener<IFrameRpcSchema, WalletContext>({
  transport: window,
  allowedOrigins: ['*'],
  middleware: [walletContextMiddleware]
})

// Now all handlers get augmented context automatically
listener.handle('frak_sendInteraction', async (params, context) => {
  // context already has productId, sourceUrl, isAutoContext!
  const { productId, sourceUrl } = context
  // ...
})
```

**Benefits:**
- ✅ No duplicate store reads in every handler
- ✅ Type-safe context access
- ✅ Centralized context augmentation logic
- ✅ Easy to add validation/logging without touching handlers
- ✅ Testable middleware in isolation

## Best Practices

1. **Keep middleware small and focused** - each middleware should do one thing
2. **Place compression early** - so subsequent middleware works with decompressed data
3. **Place logging late** - to see the final augmented context and response
4. **Use TypeScript generics** - for full type safety across the stack
5. **Handle errors gracefully** - use `FrakRpcError` for proper error codes
6. **Avoid side effects in onRequest** - keep it pure for predictability
7. **Document middleware purpose** - especially for custom business logic
8. **Test middleware independently** - easier to debug than full integration tests

## Examples

See the built-in middleware implementations for reference:
- `logging.ts` - Simple read-only middleware for monitoring
- `compression.ts` - Request/response transformation middleware

For wallet-specific examples, see the wallet app's RPC setup.
