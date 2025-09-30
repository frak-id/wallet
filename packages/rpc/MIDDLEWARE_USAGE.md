# RPC Middleware System - Usage Examples

This document provides practical examples of using the RPC middleware system for context augmentation, validation, and request/response transformation.

## Basic Setup

### Without Middleware (Old Pattern)

```typescript
import { createRpcListener } from '@frak-labs/rpc'
import type { IFrameRpcSchema } from '@frak-labs/core-sdk'

const listener = createRpcListener<IFrameRpcSchema>({
  transport: window,
  allowedOrigins: ['https://example.com']
})

listener.handle('frak_sendInteraction', async (params, context) => {
  // Every handler needs to manually extract context
  // context only has: { origin: string, source: MessageEventSource | null }
  const origin = context.origin
  // ... need to manually fetch productId, sourceUrl, etc from store
})
```

### With Middleware (New Pattern)

```typescript
import { createRpcListener } from '@frak-labs/rpc'
import type { IFrameRpcSchema } from '@frak-labs/core-sdk'

// Define custom context type
type WalletContext = {
  productId: string
  sourceUrl: string
  isAutoContext: boolean
  walletReferrer?: string
}

// Create middleware to augment context
const walletContextMiddleware = createWalletContextMiddleware()

// Create listener with context type and middleware
const listener = createRpcListener<IFrameRpcSchema, WalletContext>({
  transport: window,
  allowedOrigins: ['*'],
  middleware: [walletContextMiddleware]
})

listener.handle('frak_sendInteraction', async (params, context) => {
  // Context is now fully augmented with wallet-specific fields!
  // context has: { origin, source, productId, sourceUrl, isAutoContext, walletReferrer }
  const { productId, sourceUrl, isAutoContext } = context
  // ... use directly without fetching from store
})
```

## Wallet Context Augmentation Middleware

This is the most important middleware for the wallet - it reads from the Jotai store once and augments the context for all handlers.

```typescript
import { createStore } from 'jotai'
import type { RpcMiddleware } from '@frak-labs/rpc'
import type { IFrameRpcSchema } from '@frak-labs/core-sdk'
import { FrakRpcError, RpcErrorCodes } from '@frak-labs/rpc'

type WalletContext = {
  productId: string
  sourceUrl: string
  isAutoContext: boolean
  walletReferrer?: string
}

/**
 * Creates middleware that augments request context with wallet-specific data
 * Reads from Jotai store once per request instead of in every handler
 */
export function createWalletContextMiddleware(
  store: ReturnType<typeof createStore>
): RpcMiddleware<IFrameRpcSchema, WalletContext> {
  return {
    onRequest: async (message, context) => {
      // Read iframe state from store (once per request)
      const iframeState = await store.get(iframeStateAtom)

      // Find the iframe by origin
      const iframe = iframeState.find(i => i.origin === context.origin)

      if (!iframe) {
        throw new FrakRpcError(
          RpcErrorCodes.invalidRequest,
          `Unknown iframe origin: ${context.origin}`
        )
      }

      // Augment context with wallet-specific fields
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

## Validation Middleware

Middleware can validate requests and reject them by throwing errors:

```typescript
import type { RpcMiddleware } from '@frak-labs/rpc'
import type { IFrameRpcSchema } from '@frak-labs/core-sdk'
import { FrakRpcError, RpcErrorCodes } from '@frak-labs/rpc'

/**
 * Validates that the productId in context matches expected values
 */
export function createProductValidationMiddleware(
  allowedProducts: Set<string>
): RpcMiddleware<IFrameRpcSchema, WalletContext> {
  return {
    onRequest: (message, context) => {
      // Only validate certain methods
      if (message.topic === 'frak_sendInteraction' ||
          message.topic === 'frak_sendTransactionAction') {

        if (!allowedProducts.has(context.productId)) {
          throw new FrakRpcError(
            RpcErrorCodes.invalidParams,
            `Product ${context.productId} is not allowed`
          )
        }
      }

      return context
    }
  }
}
```

## Rate Limiting Middleware

```typescript
import type { RpcMiddleware } from '@frak-labs/rpc'
import { FrakRpcError, RpcErrorCodes } from '@frak-labs/rpc'

/**
 * Simple rate limiting based on origin
 */
export function createRateLimitMiddleware(
  maxRequestsPerMinute: number = 60
): RpcMiddleware<IFrameRpcSchema> {
  const requestCounts = new Map<string, { count: number, resetAt: number }>()

  return {
    onRequest: (message, context) => {
      const now = Date.now()
      const key = context.origin
      const limit = requestCounts.get(key)

      if (!limit || now > limit.resetAt) {
        // Reset counter
        requestCounts.set(key, {
          count: 1,
          resetAt: now + 60000 // 1 minute
        })
        return context
      }

      if (limit.count >= maxRequestsPerMinute) {
        throw new FrakRpcError(
          RpcErrorCodes.serverError,
          'Rate limit exceeded. Please try again later.'
        )
      }

      limit.count++
      return context
    }
  }
}
```

## Timing/Performance Middleware

```typescript
import type { RpcMiddleware } from '@frak-labs/rpc'

type TimingContext = {
  _startTime: number
}

/**
 * Measures request duration and logs slow requests
 */
export function createTimingMiddleware<TContext>(
  slowThresholdMs: number = 1000
): RpcMiddleware<IFrameRpcSchema, TContext & TimingContext> {
  return {
    onRequest: (message, context) => {
      return {
        ...context,
        _startTime: Date.now()
      }
    },

    onResponse: (message, response, context) => {
      const duration = Date.now() - context._startTime

      if (duration > slowThresholdMs) {
        console.warn(
          `[RPC] Slow request: ${message.topic} took ${duration}ms`,
          { origin: context.origin, id: message.id }
        )
      }

      return response
    }
  }
}
```

## Authentication Middleware

```typescript
import type { RpcMiddleware } from '@frak-labs/rpc'
import { FrakRpcError, RpcErrorCodes } from '@frak-labs/rpc'

type AuthContext = {
  isAuthenticated: boolean
  userId?: string
}

/**
 * Checks if user is authenticated before allowing certain operations
 */
export function createAuthMiddleware(
  store: ReturnType<typeof createStore>
): RpcMiddleware<IFrameRpcSchema, AuthContext> {
  return {
    onRequest: async (message, context) => {
      // Read auth state from store
      const wallet = await store.get(walletAtom)
      const isAuthenticated = !!wallet?.address

      // Augment with auth info
      const authContext = {
        ...context,
        isAuthenticated,
        userId: wallet?.address
      }

      // Require auth for certain methods
      const requiresAuth = [
        'frak_sendTransactionAction',
        'frak_openSso',
        'frak_getArticle'
      ]

      if (requiresAuth.includes(message.topic) && !isAuthenticated) {
        throw new FrakRpcError(
          RpcErrorCodes.userRejected,
          'User must be authenticated'
        )
      }

      return authContext
    }
  }
}
```

## Complete Wallet Integration Example

Here's how to integrate all middleware for the wallet:

```typescript
import { createRpcListener, createLoggingMiddleware } from '@frak-labs/rpc'
import type { IFrameRpcSchema } from '@frak-labs/core-sdk'
import { createStore } from 'jotai'

// Define complete context type
type WalletContext = {
  // From context middleware
  productId: string
  sourceUrl: string
  isAutoContext: boolean
  walletReferrer?: string
  // From auth middleware
  isAuthenticated: boolean
  userId?: string
  // From timing middleware
  _startTime: number
}

// Create Jotai store
const store = createStore()

// Create middleware instances
const contextMiddleware = createWalletContextMiddleware(store)
const authMiddleware = createAuthMiddleware(store)
const validationMiddleware = createProductValidationMiddleware(
  new Set(['product1', 'product2'])
)
const timingMiddleware = createTimingMiddleware(1000)
const rateLimitMiddleware = createRateLimitMiddleware(60)
const loggingMiddleware = createLoggingMiddleware({
  logLevel: 'info',
  prefix: '[Wallet RPC]'
})

// Create listener with all middleware
export const listener = createRpcListener<IFrameRpcSchema, WalletContext>({
  transport: window,
  allowedOrigins: ['*'],
  middleware: [
    // Order matters!
    contextMiddleware,      // 1. Augment context first
    authMiddleware,         // 2. Add auth info
    validationMiddleware,   // 3. Validate augmented context
    rateLimitMiddleware,    // 4. Check rate limits
    timingMiddleware,       // 5. Start timing
    loggingMiddleware       // 6. Log after all processing
  ]
})

// Now all handlers get the full context!
listener.handle('frak_sendInteraction', async (params, context) => {
  // context has all fields:
  const {
    origin,           // From base RpcRequestContext
    source,           // From base RpcRequestContext
    productId,        // From contextMiddleware
    sourceUrl,        // From contextMiddleware
    isAutoContext,    // From contextMiddleware
    walletReferrer,   // From contextMiddleware
    isAuthenticated,  // From authMiddleware
    userId,           // From authMiddleware
    _startTime        // From timingMiddleware
  } = context

  // No need to read from store - everything is already here!
  console.log(`Interaction for product ${productId} from ${sourceUrl}`)

  return { status: 'success' }
})

listener.handleStream('frak_listenToWalletStatus', (params, emit, context) => {
  // Same augmented context available
  const { productId, userId } = context

  // Emit status updates
  emit({ key: 'connected', wallet: userId })
})
```

## Middleware Execution Flow

```
┌─────────────────────────────────────────────────┐
│           RPC Message Received                  │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│        Origin Validation (listener)             │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│    Middleware Stack - onRequest (in order)      │
├─────────────────────────────────────────────────┤
│  1. contextMiddleware.onRequest()               │
│     → Augments: { productId, sourceUrl, ... }   │
│                                                 │
│  2. authMiddleware.onRequest()                  │
│     → Augments: { isAuthenticated, userId }     │
│                                                 │
│  3. validationMiddleware.onRequest()            │
│     → Validates augmented context               │
│                                                 │
│  4. rateLimitMiddleware.onRequest()             │
│     → Checks rate limits                        │
│                                                 │
│  5. timingMiddleware.onRequest()                │
│     → Augments: { _startTime }                  │
│                                                 │
│  6. loggingMiddleware.onRequest()               │
│     → Logs request with full context            │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│    Handler Executes with Augmented Context      │
│    handler(params, augmentedContext)            │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│   Middleware Stack - onResponse (in order)      │
├─────────────────────────────────────────────────┤
│  1. contextMiddleware.onResponse()              │
│  2. authMiddleware.onResponse()                 │
│  3. validationMiddleware.onResponse()           │
│  4. rateLimitMiddleware.onResponse()            │
│  5. timingMiddleware.onResponse()               │
│     → Logs if request was slow                  │
│  6. loggingMiddleware.onResponse()              │
│     → Logs response                             │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│           Send Response to Client               │
└─────────────────────────────────────────────────┘
```

## Error Handling in Middleware

```typescript
const errorHandlingMiddleware: RpcMiddleware<IFrameRpcSchema, WalletContext> = {
  onRequest: async (message, context) => {
    try {
      const iframe = await fetchIframeData(context.origin)
      return { ...context, productId: iframe.productId }
    } catch (error) {
      // Throwing here sends error response and stops execution
      throw new FrakRpcError(
        RpcErrorCodes.internalError,
        `Failed to load iframe data: ${error.message}`
      )
    }
  },

  onResponse: (message, response, context) => {
    // Log errors but don't modify them
    if (response.error) {
      console.error(`RPC Error in ${message.topic}:`, response.error)
    }
    return response
  }
}
```

## Testing Middleware

```typescript
import { describe, it, expect } from 'bun:test'
import { createWalletContextMiddleware } from './middleware'
import { createStore } from 'jotai'

describe('WalletContextMiddleware', () => {
  it('should augment context with iframe data', async () => {
    const store = createStore()

    // Setup store state
    store.set(iframeStateAtom, [
      {
        origin: 'https://example.com',
        productId: 'product1',
        sourceUrl: 'https://example.com/page',
        isAutoContext: true
      }
    ])

    const middleware = createWalletContextMiddleware(store)

    const message = {
      id: 'test-id',
      topic: 'frak_sendInteraction',
      data: []
    }

    const baseContext = {
      origin: 'https://example.com',
      source: null
    }

    const result = await middleware.onRequest!(message, baseContext)

    expect(result).toEqual({
      origin: 'https://example.com',
      source: null,
      productId: 'product1',
      sourceUrl: 'https://example.com/page',
      isAutoContext: true
    })
  })

  it('should throw error for unknown origin', async () => {
    const store = createStore()
    store.set(iframeStateAtom, [])

    const middleware = createWalletContextMiddleware(store)

    const message = {
      id: 'test-id',
      topic: 'frak_sendInteraction',
      data: []
    }

    const baseContext = {
      origin: 'https://unknown.com',
      source: null
    }

    await expect(
      middleware.onRequest!(message, baseContext)
    ).rejects.toThrow('Unknown iframe origin')
  })
})
```

## Next Steps for Wallet Integration

1. **Create `walletContextMiddleware.ts`** in `apps/wallet/src/context/rpc/middleware/`
2. **Define `WalletContext` type** with all fields handlers need
3. **Update `createListener` function** to use middleware:
   ```typescript
   const listener = createRpcListener<IFrameRpcSchema, WalletContext>({
     transport: window,
     allowedOrigins: ['*'],
     middleware: [walletContextMiddleware, loggingMiddleware]
   })
   ```
4. **Remove manual store reads** from all handlers - use context instead
5. **Test thoroughly** to ensure context augmentation works correctly

## Benefits of This Approach

- ✅ **Single source of truth** - Context augmentation happens once per request
- ✅ **Type-safe** - Full TypeScript support for augmented context
- ✅ **Testable** - Middleware can be tested in isolation
- ✅ **Composable** - Mix and match middleware as needed
- ✅ **Performance** - Store reads happen once, not N times per handler
- ✅ **Maintainable** - Cross-cutting concerns in one place
- ✅ **Framework-agnostic** - No dependency on Jotai or wallet-specific code in RPC package
