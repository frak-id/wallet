# Migration Guide: Phase 1 to Phase 2

This document outlines how to integrate the new `@frak-labs/rpc` package into the existing SDK and Wallet codebase.

## Overview

Phase 1 (COMPLETED) created a standalone RPC package with:
- ✅ Centralized RPC schema with `ResponseType` annotations
- ✅ Modern client API with `request()` and `stream()` methods
- ✅ Modern listener API with `handle()` and `handleStream()` methods
- ✅ 100% backward-compatible message format
- ✅ Full TypeScript type safety

Phase 2 will integrate this package into:
- SDK client code (`sdk/core/src/clients/`)
- Wallet listener code (`apps/wallet/app/views/listener.tsx`)

## Key Differences from Existing Code

### SDK Client Side

**Current Implementation (`sdk/core/src/clients/createIFrameFrakClient.ts`):**
- Uses callback-based `listenerRequest` for streaming
- Manually manages channels and message handlers
- Compression/decompression handled inline

**New Implementation (`@frak-labs/rpc`):**
- Uses async iterators for streaming
- Channels managed internally
- Cleaner separation of concerns

### Wallet Listener Side

**Current Implementation (`apps/wallet/app/views/listener.tsx`):**
- Uses `createIFrameRequestResolver` with callback-based handlers
- Each handler returns a value that gets sent back
- Streaming requires manual state management

**New Implementation (`@frak-labs/rpc`):**
- Uses `createRpcListener` with typed handlers
- Promise handlers return once
- Stream handlers receive an `emit()` function

## Migration Steps

### Step 1: Update SDK Core

#### 1.1 Add `@frak-labs/rpc` dependency

```bash
cd sdk/core
bun add @frak-labs/rpc --workspace=@frak-labs/rpc
```

#### 1.2 Create adapter for existing transport

The existing SDK transport needs to be adapted to work with the new RPC client:

```typescript
// sdk/core/src/clients/adapters/rpcClientAdapter.ts
import { createRpcClient } from '@frak-labs/rpc'
import type { IFrameTransport } from '../../types/transport'

export function createRpcClientFromTransport(
  iframe: HTMLIFrameElement,
  frakWalletUrl: string
): RpcClient {
  // Adapt the iframe to the RPC transport interface
  const transport = {
    postMessage: (message, targetOrigin) => {
      iframe.contentWindow?.postMessage(message, { targetOrigin })
    },
    addEventListener: (type, listener) => {
      window.addEventListener(type, listener)
    },
    removeEventListener: (type, listener) => {
      window.removeEventListener(type, listener)
    }
  }

  return createRpcClient({
    transport,
    targetOrigin: frakWalletUrl
  })
}
```

#### 1.3 Update `createIFrameFrakClient`

Refactor to use the new RPC client internally while maintaining the existing API:

```typescript
// sdk/core/src/clients/createIFrameFrakClient.ts
import { createRpcClientFromTransport } from './adapters/rpcClientAdapter'

export function createIFrameFrakClient({
  config,
  iframe,
}: {
  config: FrakWalletSdkConfig
  iframe: HTMLIFrameElement
}): FrakClient {
  const rpcClient = createRpcClientFromTransport(
    iframe,
    config?.walletUrl ?? 'https://wallet.frak.id'
  )

  // Build our request function (simplified)
  const request: RequestFn<IFrameRpcSchema> = async (args) => {
    await rpcClient.connect()
    return rpcClient.request(args.method, args.params)
  }

  // Build our listener function using async iterator
  const listenerRequest: ListenerRequestFn<IFrameRpcSchema> = async (
    args,
    callback
  ) => {
    await rpcClient.connect()

    // Convert async iterator to callback
    const stream = rpcClient.stream(args.method, args.params)
    for await (const result of stream) {
      callback(result)
    }
  }

  // ... rest of the implementation
}
```

### Step 2: Update Wallet Listener

#### 2.1 Add `@frak-labs/rpc` dependency

```bash
cd apps/wallet
bun add @frak-labs/rpc --workspace=@frak-labs/rpc
```

#### 2.2 Update listener hooks

Each hook needs to be adapted to the new handler signature:

**Before (existing):**
```typescript
// apps/wallet/app/module/listener/hooks/useWalletStatusListener.ts
export function useWalletStatusListener() {
  return useCallback((
    params: ExtractedParametersFromRpc<...>,
    context: IFrameResolvingContext,
    responseEmitter: IFrameResponseEmitter<...>
  ) => {
    // Emit status updates via responseEmitter
    responseEmitter({ result: status })
  }, [])
}
```

**After (new):**
```typescript
// apps/wallet/app/module/listener/hooks/useWalletStatusListener.ts
import type { StreamHandler } from '@frak-labs/rpc'

export function useWalletStatusListener(): StreamHandler<'frak_listenToWalletStatus'> {
  return useCallback((params, emit, context) => {
    // Emit status updates via emit function
    emit({ key: 'connected', wallet: '0x...' })

    // Return cleanup function if needed
    return () => {
      // cleanup
    }
  }, [])
}
```

#### 2.3 Update listener component

**Before (existing):**
```typescript
// apps/wallet/app/views/listener.tsx
const resolver = createIFrameRequestResolver({
  frak_listenToWalletStatus: onWalletListenRequest,
  frak_sendInteraction: onInteractionRequest,
  // ...
})
```

**After (new):**
```typescript
// apps/wallet/app/views/listener.tsx
import { createRpcListener } from '@frak-labs/rpc'

const listener = createRpcListener({
  transport: window,
  allowedOrigins: [] // Configure based on resolvingContext
})

// Register stream handlers
listener.handleStream('frak_listenToWalletStatus', onWalletListenRequest)

// Register promise handlers
listener.handle('frak_sendInteraction', onInteractionRequest)
listener.handle('frak_displayModal', onDisplayModalRequest)
listener.handle('frak_sso', onOpenSso)
listener.handle('frak_trackSso', onTrackSso)
listener.handle('frak_getProductInformation', onGetProductInformation)
listener.handle('frak_displayEmbeddedWallet', onDisplayEmbeddedWallet)

// Cleanup
return () => listener.cleanup()
```

### Step 3: Handle Compression/Decompression

The current implementation uses compression (`hashAndCompressData`, `decompressDataAndCheckHash`).

**Option A: Keep it in the adapter layer**

```typescript
// Wrap the RPC client with compression
function createCompressedRpcClient(rpcClient) {
  return {
    request: async (method, ...params) => {
      const compressedParams = hashAndCompressData(params)
      const result = await rpcClient.request(method, compressedParams)
      return decompressDataAndCheckHash(result)
    },
    stream: async function* (method, ...params) {
      const compressedParams = hashAndCompressData(params)
      const stream = rpcClient.stream(method, compressedParams)
      for await (const chunk of stream) {
        yield decompressDataAndCheckHash(chunk)
      }
    }
  }
}
```

**Option B: Add compression support to the RPC package**

Add compression as a middleware/plugin system in Phase 3.

### Step 4: Handle Lifecycle Events

The current implementation handles lifecycle events (handshake, heartbeat, etc.) separately. These should continue to work alongside the new RPC system:

```typescript
// The RPC listener should ignore lifecycle events
const listener = createRpcListener({
  transport: window,
  allowedOrigins: ['...']
})

// Existing lifecycle handler runs in parallel
window.addEventListener('message', (event) => {
  if ('clientLifecycle' in event.data) {
    handleLifecycleEvents(event)
    return
  }
  // RPC listener handles everything else
})
```

## Breaking Changes (None!)

The message format is identical:
```typescript
{ id, topic, data }
```

This means:
- Old SDK clients can talk to new wallet listeners
- New SDK clients can talk to old wallet listeners
- No breaking changes during migration

## Testing Strategy

1. **Unit tests**: Test RPC client and listener in isolation
2. **Integration tests**: Test with real iframe communication
3. **Backward compatibility tests**: Test new client with old listener and vice versa
4. **Migration tests**: Run both old and new implementations side-by-side

## Rollout Plan

1. **Phase 2a**: Integrate RPC package, keep old code running
2. **Phase 2b**: Feature flag to switch between old and new implementations
3. **Phase 2c**: Monitor in production, fix issues
4. **Phase 2d**: Remove old implementation

## Next Steps After Phase 2

### Phase 3: SSO Enhancement
- Use `request()` for SSO calls instead of polling
- Add timeout and retry logic
- Improve error handling

### Phase 4: Optimization
- Add compression middleware
- Add request batching
- Add caching layer

### Phase 5: Developer Experience
- Add React hooks package (`@frak-labs/rpc-react`)
- Add devtools for debugging RPC calls
- Add request/response logging

## Questions to Resolve

1. **Compression**: Where should compression/decompression live?
2. **Context**: How to pass `IFrameResolvingContext` to handlers?
3. **Origin validation**: How to dynamically update allowed origins?
4. **Lifecycle**: Should lifecycle events be part of the RPC schema?

## Files to Modify in Phase 2

### SDK Core
- [ ] `sdk/core/src/clients/createIFrameFrakClient.ts` - Use new RPC client
- [ ] `sdk/core/src/clients/adapters/rpcClientAdapter.ts` - Create adapter (new file)
- [ ] `sdk/core/package.json` - Add `@frak-labs/rpc` dependency

### Wallet
- [ ] `apps/wallet/app/views/listener.tsx` - Use new RPC listener
- [ ] `apps/wallet/app/module/listener/hooks/useWalletStatusListener.ts` - Update handler signature
- [ ] `apps/wallet/app/module/listener/hooks/useSendInteractionListener.ts` - Update handler signature
- [ ] `apps/wallet/app/module/listener/hooks/useDisplayModalListener.ts` - Update handler signature
- [ ] `apps/wallet/app/module/listener/hooks/useOnOpenSso.ts` - Update handler signature
- [ ] `apps/wallet/app/module/listener/hooks/useOnTrackSso.ts` - Update handler signature
- [ ] `apps/wallet/app/module/listener/hooks/useOnGetProductInformation.ts` - Update handler signature
- [ ] `apps/wallet/app/module/listener/hooks/useDisplayEmbeddedWallet.ts` - Update handler signature
- [ ] `apps/wallet/package.json` - Add `@frak-labs/rpc` dependency

### Cleanup (Later)
- [ ] `sdk/core/src/clients/transports/iframeMessageHandler.ts` - Can be removed
- [ ] `sdk/core/src/clients/transports/iframeChannelManager.ts` - Can be removed
- [ ] `apps/wallet/app/module/sdk/utils/iFrameRequestResolver.ts` - Can be removed
