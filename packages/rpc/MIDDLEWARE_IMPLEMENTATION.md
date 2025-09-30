# RPC Middleware System - Implementation Summary

## Overview

A comprehensive middleware system has been implemented for the `@frak-labs/rpc` package to solve the missing context information issue. This allows handlers to receive augmented context (e.g., `productId`, `sourceUrl`, `isAutoContext`) without manually reading from the Jotai store in every handler.

## Problem Solved

**Before:**
- Every handler manually reads from the Jotai store to get context
- Duplicate code across all handlers
- Tight coupling between handlers and store
- No type safety for augmented context

**After:**
- Middleware augments context once per request
- Handlers receive fully augmented context automatically
- Type-safe context augmentation via generics
- Clean separation of concerns

## Files Modified

### Core Type Definitions

#### `/packages/rpc/src/types.ts`
- Added `RpcMiddlewareContext<TCustomContext>` type for augmented context
- Added `RpcMiddleware<TSchema, TContext>` type with `onRequest` and `onResponse` hooks
- Updated `RpcPromiseHandler` and `RpcStreamHandler` to accept `TContext` generic parameter
- Updated handler signatures to use `RpcMiddlewareContext<TContext>` instead of `RpcRequestContext`

### Listener Implementation

#### `/packages/rpc/src/listener.ts`
- Updated `RpcListenerConfig<TContext>` to accept optional `middleware` array
- Updated `RpcListener<TSchema, TContext>` to be generic over context type
- Updated `createRpcListener` function signature to accept `TContext` generic parameter
- Implemented `executeOnRequestMiddleware()` - executes middleware onRequest hooks in sequence
- Implemented `executeOnResponseMiddleware()` - executes middleware onResponse hooks in sequence
- Updated `handleMessage()` to:
  - Execute onRequest middleware before handler
  - Pass augmented context to handlers
  - Execute onResponse middleware after handler
  - Handle middleware errors properly
- Updated handler registration to use augmented context type

### Exports

#### `/packages/rpc/src/index.ts`
- Exported `RpcMiddlewareContext` type
- Exported `RpcMiddleware` type
- Exported built-in middleware: `createCompressionMiddleware`, `createLoggingMiddleware`
- Exported middleware config types: `CompressionMiddlewareConfig`, `LoggingMiddlewareConfig`

## Files Created

### Built-in Middleware

#### `/packages/rpc/src/middleware/logging.ts`
A logging middleware for debugging and monitoring:
- Logs request/response information
- Configurable log level, prefix, and detail level
- Optional logging of params and response data (for security)

**Usage:**
```typescript
createLoggingMiddleware({
  logLevel: 'info',
  logParams: true,
  logResponse: false,
  prefix: '[Wallet RPC]'
})
```

#### `/packages/rpc/src/middleware/compression.ts`
A compression middleware for large payloads:
- Automatically decompresses incoming compressed requests
- Compresses responses above a size threshold
- Uses browser's native `CompressionStream` API
- Supports gzip and deflate algorithms

**Usage:**
```typescript
createCompressionMiddleware({
  threshold: 2048,  // Only compress responses > 2KB
  algorithm: 'gzip'
})
```

#### `/packages/rpc/src/middleware/index.ts`
Exports all built-in middleware

### Documentation

#### `/packages/rpc/src/middleware/README.md`
Comprehensive guide covering:
- Middleware concepts and architecture
- Context augmentation patterns
- Built-in middleware documentation
- Creating custom middleware
- Error handling
- Performance considerations
- Migration guide
- Best practices

#### `/packages/rpc/MIDDLEWARE_USAGE.md`
Practical examples including:
- Basic setup with/without middleware
- Wallet context augmentation middleware example
- Validation middleware
- Rate limiting middleware
- Timing/performance middleware
- Authentication middleware
- Complete wallet integration example
- Middleware execution flow diagram
- Error handling patterns
- Testing examples

## API Design

### Middleware Type

```typescript
type RpcMiddleware<TSchema extends RpcSchema, TContext = {}> = {
  /**
   * Called before handler execution
   * Can augment context, validate, or throw to reject
   */
  onRequest?: (
    message: RpcMessage<ExtractMethod<TSchema>>,
    context: RpcMiddlewareContext<TContext>
  ) => Promise<RpcMiddlewareContext<TContext>> | RpcMiddlewareContext<TContext>

  /**
   * Called before sending response
   * Can transform response, log, or throw error
   */
  onResponse?: (
    message: RpcMessage<ExtractMethod<TSchema>>,
    response: RpcResponse,
    context: RpcMiddlewareContext<TContext>
  ) => Promise<RpcResponse> | RpcResponse
}
```

### Context Augmentation Flow

```typescript
// 1. Define custom context type
type WalletContext = {
  productId: string
  sourceUrl: string
  isAutoContext: boolean
}

// 2. Create middleware
const contextMiddleware: RpcMiddleware<IFrameRpcSchema, WalletContext> = {
  onRequest: async (message, context) => {
    const data = await fetchWalletData(context.origin)
    return {
      ...context,
      productId: data.productId,
      sourceUrl: data.sourceUrl,
      isAutoContext: data.isAutoContext
    }
  }
}

// 3. Create listener with context type
const listener = createRpcListener<IFrameRpcSchema, WalletContext>({
  transport: window,
  allowedOrigins: ['*'],
  middleware: [contextMiddleware]
})

// 4. Handlers receive augmented context automatically
listener.handle('frak_sendInteraction', async (params, context) => {
  // context.productId, context.sourceUrl, context.isAutoContext are available!
  const { productId, sourceUrl } = context
})
```

## Type Safety

The middleware system maintains full type safety through generics:

1. **Listener is generic over context type:**
   ```typescript
   createRpcListener<TSchema, TContext>(config)
   ```

2. **Middleware must return matching context type:**
   ```typescript
   RpcMiddleware<TSchema, TContext>
   ```

3. **Handlers receive augmented context:**
   ```typescript
   RpcPromiseHandler<TSchema, TMethod, TContext>
   ```

4. **Context type flows through the entire stack:**
   - Base context: `{ origin: string, source: MessageEventSource | null }`
   - Augmented context: `RpcMiddlewareContext<TContext>` = Base + Custom fields
   - Handlers see all fields with full type inference

## Execution Flow

```
Request received
  │
  ▼
Origin validation (listener)
  │
  ▼
Middleware.onRequest (in order)
  │ - Middleware 1 augments context
  │ - Middleware 2 augments more
  │ - Middleware 3 validates
  │ - ...
  │
  ▼
Handler executes with augmented context
  │
  ▼
Middleware.onResponse (in order)
  │ - Middleware 1 transforms response
  │ - Middleware 2 logs
  │ - ...
  │
  ▼
Response sent to client
```

## Error Handling

### Request Errors (onRequest)
- Middleware can throw to reject requests
- Thrown errors become RPC error responses
- Execution stops at the throwing middleware
- Use `FrakRpcError` for proper error codes

### Response Errors (onResponse)
- For **promise handlers**: Error replaces success response
- For **stream handlers**: Error logged, chunk skipped, stream continues
- Prevents one bad chunk from killing entire stream

## Performance Considerations

1. **Middleware runs once per request** - Not per emit for streams
2. **Async middleware is awaited** - Keep fast
3. **Context augmentation happens before handler** - Safe to cache data
4. **Stream response middleware runs per chunk** - Keep minimal for streams
5. **Middleware executes in order** - Order matters for dependencies

## Next Steps for Wallet Integration

### 1. Create Wallet Context Middleware

Create `/apps/wallet/src/context/rpc/middleware/walletContext.ts`:

```typescript
import type { RpcMiddleware } from '@frak-labs/rpc'
import type { IFrameRpcSchema } from '@frak-labs/core-sdk'
import { FrakRpcError, RpcErrorCodes } from '@frak-labs/rpc'

export type WalletContext = {
  productId: string
  sourceUrl: string
  isAutoContext: boolean
  walletReferrer?: string
}

export function createWalletContextMiddleware(
  store: ReturnType<typeof createStore>
): RpcMiddleware<IFrameRpcSchema, WalletContext> {
  return {
    onRequest: async (message, context) => {
      const iframeState = await store.get(iframeStateAtom)
      const iframe = iframeState.find(i => i.origin === context.origin)

      if (!iframe) {
        throw new FrakRpcError(
          RpcErrorCodes.invalidRequest,
          `Unknown iframe origin: ${context.origin}`
        )
      }

      return {
        ...context,
        productId: iframe.productId,
        sourceUrl: iframe.sourceUrl,
        isAutoContext: iframe.isAutoContext,
        walletReferrer: iframe.walletReferrer
      }
    }
  }
}
```

### 2. Update Listener Creation

Modify `/apps/wallet/src/context/rpc/listener.ts`:

```typescript
import { createRpcListener, createLoggingMiddleware } from '@frak-labs/rpc'
import type { IFrameRpcSchema } from '@frak-labs/core-sdk'
import { createWalletContextMiddleware, type WalletContext } from './middleware/walletContext'

const store = getStore()

export const listener = createRpcListener<IFrameRpcSchema, WalletContext>({
  transport: window,
  allowedOrigins: ['*'],
  middleware: [
    createWalletContextMiddleware(store),
    createLoggingMiddleware({ logLevel: 'info', prefix: '[Wallet RPC]' })
  ]
})
```

### 3. Update All Handlers

Remove manual store reads:

**Before:**
```typescript
listener.handle('frak_sendInteraction', async (params, context) => {
  const store = getStore()
  const iframeState = await store.get(iframeStateAtom)
  const iframe = iframeState.find(i => i.origin === context.origin)
  const productId = iframe.productId
  // ...
})
```

**After:**
```typescript
listener.handle('frak_sendInteraction', async (params, context) => {
  const { productId, sourceUrl, isAutoContext } = context
  // Everything already available!
})
```

### 4. Type Check and Test

```bash
bun run typecheck  # Should pass with full type safety
bun test           # Test middleware in isolation
```

## Benefits

- ✅ **Single source of truth** - Context augmentation in one place
- ✅ **Type-safe** - Full TypeScript support
- ✅ **Performance** - Store reads once per request, not N times
- ✅ **Testable** - Middleware tested in isolation
- ✅ **Composable** - Mix and match middleware
- ✅ **Framework-agnostic** - No Jotai or wallet dependencies in RPC package
- ✅ **Maintainable** - Cross-cutting concerns centralized
- ✅ **Extensible** - Easy to add validation, logging, etc.

## Compilation Status

✅ **All TypeScript types compile successfully**
- No type errors in `packages/rpc`
- All dependent packages compile
- Full type inference works end-to-end

## Testing

The middleware system can be tested independently:

```typescript
import { test, expect } from 'bun:test'
import { createWalletContextMiddleware } from './walletContext'

test('augments context with wallet data', async () => {
  const store = createStore()
  store.set(iframeStateAtom, [
    { origin: 'https://example.com', productId: 'p1', sourceUrl: 'url1' }
  ])

  const middleware = createWalletContextMiddleware(store)

  const result = await middleware.onRequest!(
    { id: '1', topic: 'test', data: {} },
    { origin: 'https://example.com', source: null }
  )

  expect(result.productId).toBe('p1')
  expect(result.sourceUrl).toBe('url1')
})
```

## Migration Path

1. ✅ Implement middleware system in `packages/rpc` (COMPLETE)
2. 🔲 Create wallet context middleware in `apps/wallet`
3. 🔲 Update listener creation to use middleware
4. 🔲 Remove manual store reads from all handlers
5. 🔲 Test thoroughly
6. 🔲 Deploy and monitor

## Additional Resources

- See `/packages/rpc/src/middleware/README.md` for detailed middleware guide
- See `/packages/rpc/MIDDLEWARE_USAGE.md` for practical examples
- See built-in middleware implementations for reference patterns
