# Refactoring Wallet-SDK Communication and SSO Flow (v4)

## 1. Introduction and Goal

This document outlines a refined plan to refactor the communication layer between the Frak Wallet and the SDK. The goal is to create a robust, type-safe, and **backward-compatible** system by centralizing the RPC logic into a new `packages/rpc` package, while introducing a modern, powerful API for developers.

This refactoring will:
-   **Centralize the existing RPC schema** for better maintainability.
-   **Maintain the exact same on-the-wire message format** (`{ id, topic, data }`) to ensure 100% backwards compatibility.
-   **Introduce a modern API** with `request()` (for Promises) and `stream()` (for Async Iterators) methods, abstracting away the underlying message passing.
-   **Improve the SSO flow** by replacing polling with direct, secure RPC calls.

## 2. Phase 1: Create `packages/rpc` with a Modern API

This package will provide the new developer-facing API while internally using the existing, unchanged message protocol.

### 2.1. Centralize and Enhance the RPC Schema

We will move `IFrameRpcSchema` to `packages/rpc/src/rpc-schema.ts` and enhance it to denote the response type.

```typescript
// packages/rpc/src/rpc-schema.ts
// ... (all existing types from @sdk/core/src/types/rpc.ts)

// Add a 'ResponseType' to each schema entry
export type IFrameRpcSchema = [
    {
        Method: "frak_listenToWalletStatus";
        Parameters?: undefined;
        ReturnType: WalletStatusReturnType;
        ResponseType: "stream"; // This method streams updates
    },
    {
        Method: "frak_sendInteraction";
        Parameters: [ /*...*/ ];
        ReturnType: SendInteractionReturnType;
        ResponseType: "promise"; // This is a one-shot request
    },
    // ... etc for all other methods
];
```

### 2.2. Implement the RPC Client (SDK-side)

The client will expose `request` and `stream` methods but send the same old message format.

```typescript
// packages/rpc/src/client.ts
export function createRpcClient(transport, targetOrigin) {
    // ... internal logic for message listening and request queuing ...

    // For one-shot requests like `frak_sendInteraction`
    const request = async (method, params) => {
        const id = crypto.randomUUID();
        // BACKWARDS COMPATIBILITY: Send the original message format
        transport.postMessage({ id, topic: method, data: params });
        // ... returns a promise that resolves when a response with the same id is received
    };

    // For streaming requests like `frak_listenToWalletStatus`
    const stream = (method, params) => {
        const id = crypto.randomUUID();
        transport.postMessage({ id, topic: method, data: params });

        return (async function* () {
            // ... returns an async iterator that yields data from response messages
            // with the same id, until a cancellation or end message is received.
        })();
    };

    // ... connect/handshake logic remains the same ...

    return { connect, request, stream, cleanup };
}
```

### 2.3. Implement the RPC Listener (Wallet-side)

The listener will handle the unchanged message format and provide a special `emitter` for streaming handlers.

```typescript
// packages/rpc/src/listener.ts
export function createRpcListener(transport, allowedOrigins) {
    const promiseHandlers = new Map();
    const streamHandlers = new Map();

    const handleMessage = (event) => {
        // ... origin check ...
        // No need for compatibility logic, as the message format is the same.
        const { id, topic, data } = event.data;

        // Handle promise-based requests
        if (promiseHandlers.has(topic)) {
            const handler = promiseHandlers.get(topic);
            handler(data).then(result => {
                transport.postMessage({ id, topic, data: result });
            });
        }

        // Handle stream-based requests
        if (streamHandlers.has(topic)) {
            const handler = streamHandlers.get(topic);
            const emitter = (chunk) => transport.postMessage({ id, topic, data: chunk });
            handler(data, emitter);
        }
    };

    transport.addEventListener('message', handleMessage);

    return {
        handle: (method, handler) => promiseHandlers.set(method, handler),
        handleStream: (method, handler) => streamHandlers.set(method, handler),
        cleanup: () => transport.removeEventListener('message', handleMessage),
    };
}
```

## 3. Phase 2: Refactor SDK and Wallet

### 3.1. Refactor SDK Client

The SDK will be updated to use the new `request`/`stream` API.

**Example - Consuming a Stream:**
```typescript
// @sdk/core/src/some-feature.ts

const client = await createCommunicationClient({ /* ... */ });

// The old callback-based API is replaced with a clean loop.
const walletStatusStream = client.stream('frak_listenToWalletStatus');
for await (const status of walletStatusStream) {
    console.log('Received new wallet status:', status);
}
```

### 3.2. Refactor Wallet Listener

The wallet listener will register its handlers using `handle` or `handleStream`.

**File to refactor:** `@apps/wallet/app/views/listener.tsx`

```typescript
// @apps/wallet/app/views/listener.tsx (Refactored)
function ListenerContent() {
    useEffect(() => {
        const rpcListener = createRpcListener(/* ... */);

        // Register a one-shot handler
        rpcListener.handle('frak_sendInteraction', onInteractionRequest);

        // Register a streaming handler
        rpcListener.handleStream('frak_listenToWalletStatus', (params, emit) => {
            // `onWalletListenRequest` would be adapted to use the emitter
            // instead of returning a single value.
            onWalletListenRequest(params, emit);
        });

        // ...

        return () => rpcListener.cleanup();
    }, [/* ... */]);
}
```

## 4. Phase 3: Augment SSO Flow

The SSO flow will use the same `request`-based RPC calls, as it's a one-shot interaction. The implementation remains the same as in `v3`, as it already fits this model perfectly. This ensures the SSO communication is robust and consistent with the rest of the system.

## 5. Conclusion

This `v4` plan presents a robust and elegant path forward. By **keeping the message protocol stable**, we guarantee backwards compatibility. By introducing a new logical layer in `packages/rpc`, we provide a vastly improved, modern developer experience with **promises and async iterators**, moving away from callbacks. This approach gives us the best of both worlds: stability and modern API design.

