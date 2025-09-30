# Phase 2 & 3 Refactoring Analysis and Implementation Plan

## Executive Summary

This document provides a comprehensive analysis of the current wallet-SDK communication architecture and a detailed implementation plan for Phase 2 (SDK + Wallet refactoring) and Phase 3 (SSO flow augmentation) of the RPC modernization project.

**Key Findings:**
- Current architecture uses callback-based patterns throughout
- 8 RPC methods currently implemented (7 handlers + 1 lifecycle)
- SSO flow uses polling mechanism at 500ms intervals (performance concern)
- Message format is stable: `{ id, topic, data }` with compression
- Clean separation between promise-based and streaming handlers already conceptually present

---

## Part 1: Current Architecture Analysis

### 1.1 Message Protocol (Unchanged)

**Wire Format:**
```typescript
{
  id: string;           // UUID
  topic: string;        // Method name (e.g., "frak_listenToWalletStatus")
  data: CompressedData; // hashAndCompressData() output
}
```

**Compression:**
- Uses `hashAndCompressData()` / `decompressDataAndCheckHash()`
- Provides integrity verification via hash
- Located: `sdk/core/src/utils/compression/`

### 1.2 Current RPC Methods

**Streaming Handlers (Multiple Emissions):**
1. `frak_listenToWalletStatus` - Emits on session changes via Jotai subscriptions
   - Handler: `apps/wallet/app/module/listener/hooks/useWalletStatusListener.ts`
   - Subscribes to `sessionAtom` and `sdkSessionAtom`
   - Emits on every state change
   - Pushes backup data after emission

**Promise Handlers (Single Response):**
2. `frak_sendInteraction` - Sends user interaction to backend
   - Handler: `apps/wallet/app/module/listener/hooks/useSendInteractionListener.ts`
   - Validates productId match
   - Returns delegation ID or error

3. `frak_displayModal` - Shows modal with multi-step flow
   - Handler: `apps/wallet/app/module/listener/hooks/useDisplayModalListener.ts`
   - Complex state management (Jotai atoms for modal state)
   - Auto-skips login/openSession if already authenticated

4. `frak_sso` - Opens SSO popup/window
   - Handler: `apps/wallet/app/module/listener/hooks/useOnOpenSso.ts`
   - Generates SSO link via `useGetOpenSsoLink`
   - Returns `trackingId` if `consumeKey` provided
   - Opens popup or same window based on config

5. `frak_trackSso` - Polls SSO status (PERFORMANCE CONCERN)
   - Handler: `apps/wallet/app/module/listener/hooks/useOnTrackSso.ts`
   - **Current Implementation:** Polling every 500ms until status !== "pending"
   - Hits backend: `authenticatedWalletApi.auth.sso.consume.post()`
   - Emits final status when SSO completes or fails
   - **No cleanup mechanism for interval** (potential memory leak)

6. `frak_getProductInformation` - Fetches product metadata
   - Handler: `apps/wallet/app/module/listener/hooks/useOnGetProductInformation.ts`
   - Uses TanStack Query for caching
   - Returns on-chain metadata + estimated rewards

7. `frak_displayEmbeddedWallet` - Shows embedded wallet UI
   - Handler: `apps/wallet/app/module/listener/hooks/useDisplayEmbeddedWallet.ts`
   - Sets listener UI request state

### 1.3 SDK Client Architecture

**Core Files:**
- **Client Creation:** `sdk/core/src/clients/createIFrameFrakClient.ts`
- **Message Handler:** `sdk/core/src/clients/transports/iframeMessageHandler.ts`
- **Channel Manager:** `sdk/core/src/clients/transports/iframeChannelManager.ts`
- **Lifecycle Manager:** `sdk/core/src/clients/transports/iframeLifecycleManager.ts`

**Current API:**
```typescript
interface FrakClient {
  request: RequestFn<IFrameRpcSchema>;           // Promise-based
  listenerRequest: ListenerRequestFn<IFrameRpcSchema>; // Callback-based streaming
  waitForConnection: Promise<boolean>;
  waitForSetup: Promise<void>;
  destroy: () => Promise<void>;
}
```

**`request()` Implementation:**
- Creates deferred promise
- Creates channel with single-response handler
- Sends compressed message
- Resolves promise on response, then closes channel
- Line 69-118 in `createIFrameFrakClient.ts`

**`listenerRequest()` Implementation:**
- Creates channel with persistent callback handler
- Does NOT close channel after first response
- Keeps calling callback for each emission
- Line 120-160 in `createIFrameFrakClient.ts`

### 1.4 Wallet Listener Architecture

**Core Files:**
- **Main Listener:** `apps/wallet/app/views/listener.tsx`
- **Request Resolver:** `apps/wallet/app/module/sdk/utils/iFrameRequestResolver.ts`

**Current Pattern:**
```typescript
// Resolver receives: (params, context, emitter)
type IFrameRequestResolver<TParams> = (
  params: TParams,
  context: IFrameResolvingContext,
  responseEmitter: IFrameResponseEmitter<TParams>
) => Promise<void>;

// Emitter is async function that sends response
type IFrameResponseEmitter<TParameters> = (
  result: RpcResponse<IFrameRpcSchema, TParameters["method"]>
) => Promise<void>;
```

**Message Flow:**
1. `window.addEventListener('message')` in `iFrameRequestResolver.ts` (line 157)
2. Origin validation against `currentContext.productId`
3. Decompress message data
4. Look up resolver in `resolversMap`
5. Build emitter that compresses + postMessage
6. Call resolver: `await resolver(params, context, emitter)`

### 1.5 React SDK Hooks

**Wrapper Hooks (in `sdk/react/src/hook/`):**
- `useWalletStatus()` - Uses `watchWalletStatus()` with TanStack Query
  - Sets up `listenerRequest` with callback that updates query cache
  - Line 31-39: `newStatusUpdated` callback updates query data

- `useOpenSso()` - Wraps `openSso()` with TanStack useMutation
  - Simple promise-based call, no streaming

- `useTrackSso()` - **PROBLEMATIC IMPLEMENTATION**
  - Uses `useEffect` to call `trackSso()`
  - Current SDK function appears to be promise-based (returns once)
  - But wallet handler does polling internally
  - Disconnect between API design (promise) and actual behavior (polling)

---

## Part 2: Identified Issues & Performance Concerns

### 2.1 SSO Polling Performance

**Current Implementation Problems:**

1. **High Polling Frequency:** 500ms interval (line 120-122 in `useOnTrackSso.ts`)
   - 2 requests per second until SSO completes
   - No exponential backoff
   - Backend load scales with concurrent SSO attempts

2. **No Cleanup in SDK:**
   - `trackSso()` in SDK returns promise immediately
   - React hook has cleanup, but doesn't cancel server-side polling
   - Wallet-side interval may continue after client disconnects

3. **Inefficient State Propagation:**
   - Backend polls database for SSO status
   - Wallet polls backend
   - Could be replaced with single request + stream response

### 2.2 React Re-render Concerns

**Current Listeners (Wallet-side):**

1. **`useWalletStatusListener`** - Potential cascade issue:
   - Creates new `emitCurrentStatus` function on `queryClient` change (line 55-129)
   - Subscribes to two Jotai atoms (line 156-165)
   - Each subscription creates new AbortController
   - If QueryClient ref changes frequently, entire listener rebuilds

2. **`useOnTrackSso`** - Memory leak risk:
   - Creates interval but only clears on final status (line 63-65)
   - No cleanup return in resolver function (line 124-126)
   - If RPC channel closes early, interval continues forever

3. **Hook Dependencies:**
   - Most hooks use `useCallback` with appropriate deps
   - `useDisplayModalListener` depends on `setRequest` (line 100)
   - `setRequest` stability depends on `ListenerUiProvider` implementation

### 2.3 Type Safety Gaps

1. **No ResponseType in Schema:**
   - Current `IFrameRpcSchema` doesn't distinguish stream vs promise methods
   - Plan correctly identifies need for `ResponseType: "stream" | "promise"` field
   - Would enable compile-time enforcement of correct API usage

2. **Type Erasure in Resolver:**
   - Line 152 in `iFrameRequestResolver.ts`: `// @ts-ignore`
   - Resolver map type is correct, but type erasure at call site
   - Could be fixed with better type narrowing

---

## Part 3: Migration Strategy & Implementation Plan

### 3.1 Phase 2A: Create `packages/rpc` (Foundation)

**New Package Structure:**
```
packages/rpc/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── schema.ts          # Enhanced IFrameRpcSchema with ResponseType
│   ├── client.ts          # SDK-side: request() + stream()
│   ├── listener.ts        # Wallet-side: handle() + handleStream()
│   ├── types.ts           # Shared types
│   └── utils/
│       ├── deferred.ts    # Move from core-sdk
│       └── compression.ts # Re-export from core-sdk
```

**Dependencies:**
- `viem` (for types like `Hex`, `Address`)
- `@frak-labs/core-sdk` (for compression utilities)
- Must be buildable independently

**Step-by-Step:**

1. **Create package scaffold:**
   ```bash
   mkdir -p packages/rpc/src/utils
   # Copy package.json template from other packages
   # Add to workspace root package.json
   ```

2. **Migrate schema with ResponseType:**
   ```typescript
   // packages/rpc/src/schema.ts
   export type IFrameRpcSchema = [
     {
       Method: "frak_listenToWalletStatus";
       Parameters?: undefined;
       ReturnType: WalletStatusReturnType;
       ResponseType: "stream"; // NEW FIELD
     },
     {
       Method: "frak_sendInteraction";
       Parameters: [Hex, PreparedInteraction, Hex?];
       ReturnType: SendInteractionReturnType;
       ResponseType: "promise"; // NEW FIELD
     },
     // ... rest of methods
   ];
   ```

3. **Implement RPC Client (`packages/rpc/src/client.ts`):**

   **Key Design Decisions:**
   - `request()` creates channel, returns promise, auto-closes on response
   - `stream()` creates channel, returns async iterator, closes on abort/error
   - Reuses existing compression utilities
   - Maintains exact same wire format

   **Performance Considerations:**
   - Async iterator allows consumer to control backpressure
   - Channel cleanup prevents memory leaks
   - AbortController support for cancellation

   **Pseudo-code:**
   ```typescript
   export function createRpcClient(transport, targetOrigin) {
     const channels = new Map<string, ChannelHandler>();
     const messageQueue = new Map<string, unknown[]>();

     // Listen to messages
     function handleMessage(event: MessageEvent) {
       if (event.origin !== targetOrigin) return;

       const { id, topic, data } = event.data;
       const decompressed = decompressDataAndCheckHash(data);

       const channel = channels.get(id);
       if (channel) {
         channel.onMessage(decompressed);
       } else {
         // Queue messages for channels not yet created
         messageQueue.get(id)?.push(decompressed);
       }
     }

     window.addEventListener('message', handleMessage);

     // Promise-based request
     async function request(method, params) {
       const id = crypto.randomUUID();
       const deferred = new Deferred();

       channels.set(id, {
         onMessage: (data) => {
           if (data.error) deferred.reject(data.error);
           else deferred.resolve(data.result);
           channels.delete(id); // Auto-cleanup
         }
       });

       transport.postMessage({
         id,
         topic: method,
         data: hashAndCompressData({ method, params })
       });

       return deferred.promise;
     }

     // Stream-based request
     async function* stream(method, params, signal?: AbortSignal) {
       const id = crypto.randomUUID();
       const queue: unknown[] = messageQueue.get(id) ?? [];
       messageQueue.delete(id);

       const deferred = new Deferred();

       channels.set(id, {
         onMessage: (data) => {
           if (data.error) {
             deferred.reject(data.error);
           } else {
             queue.push(data.result);
             deferred.resolve(); // Wake up iterator
           }
         }
       });

       // Send initial request
       transport.postMessage({
         id,
         topic: method,
         data: hashAndCompressData({ method, params })
       });

       // Yield queued/new messages
       try {
         while (!signal?.aborted) {
           while (queue.length > 0) {
             yield queue.shift();
           }
           await Promise.race([
             deferred.promise,
             signal ? abortToPromise(signal) : Promise.resolve()
           ]);
         }
       } finally {
         channels.delete(id); // Cleanup
       }
     }

     function cleanup() {
       window.removeEventListener('message', handleMessage);
       channels.clear();
     }

     return { request, stream, cleanup };
   }
   ```

4. **Implement RPC Listener (`packages/rpc/src/listener.ts`):**

   **Key Design Decisions:**
   - Two registration methods: `handle()` for promises, `handleStream()` for streams
   - Stream handlers receive `emitter` function for multiple emissions
   - Promise handlers auto-emit response once
   - Maintain same message format

   **Pseudo-code:**
   ```typescript
   export function createRpcListener(transport, allowedOrigins) {
     const promiseHandlers = new Map();
     const streamHandlers = new Map();

     function handleMessage(event: MessageEvent) {
       if (!allowedOrigins.includes(event.origin)) return;

       const { id, topic, data } = event.data;
       const decompressed = decompressDataAndCheckHash(data);

       const emitter = (result) => {
         event.source?.postMessage({
           id,
           topic,
           data: hashAndCompressData(result)
         }, { targetOrigin: event.origin });
       };

       // Promise handler
       if (promiseHandlers.has(topic)) {
         const handler = promiseHandlers.get(topic);
         handler(decompressed)
           .then(result => emitter({ result }))
           .catch(error => emitter({ error }));
       }

       // Stream handler
       if (streamHandlers.has(topic)) {
         const handler = streamHandlers.get(topic);
         handler(decompressed, emitter);
       }
     }

     transport.addEventListener('message', handleMessage);

     return {
       handle: (method, handler) => promiseHandlers.set(method, handler),
       handleStream: (method, handler) => streamHandlers.set(method, handler),
       cleanup: () => transport.removeEventListener('message', handleMessage)
     };
   }
   ```

### 3.2 Phase 2B: Refactor SDK Core

**Files to Modify:**

1. **`sdk/core/src/types/client.ts`** - Update FrakClient interface:
   ```typescript
   export type FrakClient = {
     config: FrakWalletSdkConfig;
     debugInfo: { formatDebugInfo: (error: unknown) => string };
     openPanel?: OpenPanel;

     // NEW: Modern API (replaces request + listenerRequest)
     rpc: {
       request: <M extends MethodName>(
         method: M,
         params: ParamsForMethod<M>
       ) => Promise<ReturnTypeForMethod<M>>;

       stream: <M extends StreamMethodName>(
         method: M,
         params: ParamsForMethod<M>,
         signal?: AbortSignal
       ) => AsyncIterableIterator<ReturnTypeForMethod<M>>;
     };

     // DEPRECATED: Keep for backward compatibility
     /** @deprecated Use rpc.request() instead */
     request: RequestFn<IFrameRpcSchema>;
     /** @deprecated Use rpc.stream() instead */
     listenerRequest: ListenerRequestFn<IFrameRpcSchema>;

     waitForConnection: Promise<boolean>;
     waitForSetup: Promise<void>;
     destroy: () => Promise<void>;
   };
   ```

2. **`sdk/core/src/clients/createIFrameFrakClient.ts`** - Integrate new RPC client:
   ```typescript
   import { createRpcClient } from '@frak-labs/rpc';

   export function createIFrameFrakClient({ config, iframe }) {
     // ... existing setup ...

     // Create modern RPC client
     const rpcClient = createRpcClient(
       iframe.contentWindow,
       config.walletUrl ?? "https://wallet.frak.id"
     );

     // Wrap with method-specific functions
     const rpc = {
       request: (method, params) => rpcClient.request(method, params),
       stream: (method, params, signal) => rpcClient.stream(method, params, signal)
     };

     // Keep old API for backward compatibility (delegates to new API)
     const request: RequestFn = (args) => rpc.request(args.method, args.params);
     const listenerRequest: ListenerRequestFn = (args, callback) => {
       (async () => {
         for await (const result of rpc.stream(args.method, args.params)) {
           callback(result);
         }
       })();
     };

     // Update destroy to include RPC cleanup
     const destroy = async () => {
       stopHeartbeat();
       channelManager.destroy();
       messageHandler.cleanup();
       rpcClient.cleanup(); // NEW
       iframe.remove();
     };

     return {
       config,
       debugInfo,
       rpc,           // NEW
       request,       // DEPRECATED
       listenerRequest, // DEPRECATED
       waitForConnection,
       waitForSetup,
       destroy,
       openPanel
     };
   }
   ```

3. **Update action wrappers to use new API:**

   **`sdk/core/src/actions/watchWalletStatus.ts`:**
   ```typescript
   export async function* watchWalletStatus(
     client: FrakClient,
     signal?: AbortSignal
   ): AsyncIterableIterator<WalletStatusReturnType> {
     for await (const status of client.rpc.stream(
       'frak_listenToWalletStatus',
       undefined,
       signal
     )) {
       walletStatusSideEffect(client, status);
       yield status;
     }
   }

   // Backward compatible wrapper
   export function watchWalletStatusCallback(
     client: FrakClient,
     callback: (status: WalletStatusReturnType) => void
   ): () => void {
     const controller = new AbortController();

     (async () => {
       for await (const status of watchWalletStatus(client, controller.signal)) {
         callback(status);
       }
     })();

     return () => controller.abort();
   }
   ```

   **`sdk/core/src/actions/openSso.ts`** - No change (already promise-based):
   ```typescript
   export async function openSso(
     client: FrakClient,
     args: OpenSsoParamsType
   ): Promise<OpenSsoReturnType> {
     // Use new API
     return client.rpc.request('frak_sso', [
       args,
       client.config.metadata.name,
       client.config.customizations?.css
     ]);
   }
   ```

   **`sdk/core/src/actions/trackSso.ts`** - **MAJOR CHANGE (streaming):**
   ```typescript
   export async function* trackSso(
     client: FrakClient,
     args: TrackSsoParamsType,
     signal?: AbortSignal
   ): AsyncIterableIterator<TrackSsoReturnType> {
     yield* client.rpc.stream('frak_trackSso', [args], signal);
   }
   ```

### 3.3 Phase 2C: Refactor Wallet Listener

**Files to Modify:**

1. **`apps/wallet/app/views/listener.tsx`** - Main refactor:
   ```typescript
   import { createRpcListener } from '@frak-labs/rpc';

   function ListenerContent() {
     const [listener, setListener] = useState<ReturnType<typeof createRpcListener>>();

     // All existing hooks remain the same
     const onWalletListenRequest = useWalletStatusListener();
     const onInteractionRequest = useSendInteractionListener();
     const onDisplayModalRequest = useDisplayModalListener();
     const onDisplayEmbeddedWallet = useDisplayEmbeddedWallet();
     const onOpenSso = useOnOpenSso();
     const onTrackSso = useOnTrackSso(); // Modified in 2C.2
     const onGetProductInformation = useOnGetProductInformation();

     useEffect(() => {
       const newListener = createRpcListener(window, ['allowed-origins']);

       // Register promise-based handlers
       newListener.handle('frak_sendInteraction', onInteractionRequest);
       newListener.handle('frak_displayModal', onDisplayModalRequest);
       newListener.handle('frak_sso', onOpenSso);
       newListener.handle('frak_getProductInformation', onGetProductInformation);
       newListener.handle('frak_displayEmbeddedWallet', onDisplayEmbeddedWallet);

       // Register streaming handlers
       newListener.handleStream('frak_listenToWalletStatus', onWalletListenRequest);
       newListener.handleStream('frak_trackSso', onTrackSso); // CHANGED

       setListener(newListener);

       return () => newListener.cleanup();
     }, [
       onWalletListenRequest,
       onInteractionRequest,
       onDisplayModalRequest,
       onOpenSso,
       onTrackSso,
       onGetProductInformation,
       onDisplayEmbeddedWallet
     ]);

     // Ready handler remains same
     useEffect(() => {
       if (listener && typeof onWalletListenRequest === 'function') {
         listener.setReadyToHandleRequest();
       }
     }, [listener, onWalletListenRequest]);

     // ... rest remains same
   }
   ```

2. **Modify streaming handler hooks** to match new signature:

   **`apps/wallet/app/module/listener/hooks/useWalletStatusListener.ts`:**
   ```typescript
   // OLD SIGNATURE:
   // (params, context, emitter) => Promise<void>

   // NEW SIGNATURE:
   // (params, emitter) => Promise<void>
   // Note: Context removed, will be passed via closure or global state

   export function useWalletStatusListener() {
     const queryClient = useQueryClient();
     const sessionsRef = useRef();
     // ... existing setup ...

     return useCallback(
       async (params, emitter) => { // NEW SIGNATURE
         const context = jotaiStore.get(iframeResolvingContextAtom);

         // Subscribe to session changes
         const unsubscribe1 = jotaiStore.sub(sessionAtom, () => {
           emitCurrentStatus(context, emitter);
         });
         const unsubscribe2 = jotaiStore.sub(sdkSessionAtom, () => {
           emitCurrentStatus(context, emitter);
         });

         // Emit initial status
         await emitCurrentStatus(context, emitter);

         // Note: No cleanup return possible in current design
         // Client must handle AbortSignal for cancellation
       },
       [emitCurrentStatus]
     );
   }
   ```

   **CONCERN:** Current design doesn't support cleanup from handler side. Solutions:
   - Option A: Add cleanup function to emitter object: `emitter.onAbort(cleanup)`
   - Option B: Pass AbortSignal to handler: `(params, emitter, signal) => {}`
   - Option C: Handler returns cleanup function (async generator pattern)

   **RECOMMENDATION:** Option B - Add AbortSignal parameter:
   ```typescript
   // Updated signature:
   type StreamHandler = (
     params: unknown,
     emitter: (result: unknown) => void,
     signal: AbortSignal
   ) => Promise<void>;

   // Updated usage:
   return useCallback(
     async (params, emitter, signal) => {
       const cleanup1 = jotaiStore.sub(sessionAtom, () => {...});
       const cleanup2 = jotaiStore.sub(sdkSessionAtom, () => {...});

       signal.addEventListener('abort', () => {
         cleanup1();
         cleanup2();
       });

       await emitCurrentStatus(context, emitter);
     },
     [emitCurrentStatus]
   );
   ```

3. **Modify promise handler hooks** (minimal changes):

   These hooks already return promises and call emitter once - perfect fit!

   **`apps/wallet/app/module/listener/hooks/useSendInteractionListener.ts`:**
   ```typescript
   // Current signature already compatible:
   return useCallback(
     async (request, context, emitter) => {
       // ... existing logic ...
       await emitter({ result: { delegationId } });
     },
     [pushInteraction]
   );
   ```

   **Only change needed:** Remove `context` parameter (get from Jotai instead):
   ```typescript
   return useCallback(
     async (request, emitter) => { // Remove context param
       const context = jotaiStore.get(iframeResolvingContextAtom);
       // ... rest unchanged ...
     },
     [pushInteraction]
   );
   ```

### 3.4 Phase 3: SSO Flow Refactoring (Performance Critical)

**Current Flow (Inefficient):**
```
Client                    Wallet Listener            Backend
  |                              |                       |
  |--frak_trackSso-------------->|                       |
  |                              |--poll (500ms)-------->|
  |<----pending------------------|<--pending-------------|
  |                              |--poll (500ms)-------->|
  |<----pending------------------|<--pending-------------|
  |                              |--poll (500ms)-------->|
  |<----connected----------------|<--success-------------|
```

**New Flow (Efficient):**
```
Client                    Wallet Listener            Backend
  |                              |                       |
  |--frak_trackSso-------------->|                       |
  |                              |--single request------>|
  |<----pending------------------|<--pending-------------|
  |                              |  [backend subscribes  |
  |                              |   to SSO completion]  |
  |<----pending------------------|<--pending-------------|
  |                              |  [SSO completed]      |
  |<----connected----------------|<--success-------------|
```

**Backend Changes Required (Out of Scope for This Analysis):**
- Add streaming endpoint: `POST /auth/sso/consume/stream`
- Use long-polling or WebSocket to push status updates
- Emit on SSO completion instead of requiring polling

**Wallet Handler Changes:**

**`apps/wallet/app/module/listener/hooks/useOnTrackSso.ts` (Refactored):**
```typescript
type OnTrackSso = StreamHandler<
  Extract<ExtractedParametersFromRpc<IFrameRpcSchema>, { method: "frak_trackSso" }>
>;

export function useOnTrackSso(): OnTrackSso {
  return useCallback(
    async (request, emitter, signal) => {
      const { consumeKey, trackingId } = request.params[0];
      const context = jotaiStore.get(iframeResolvingContextAtom);
      const { productId } = context;

      // Emit initial pending status
      await emitter({ result: { key: "not-connected" } });

      try {
        // Single backend call instead of polling
        const { data, error } = await authenticatedWalletApi.auth.sso.consume.post({
          id: trackingId,
          productId,
          consumeKey,
        }, { signal }); // Pass AbortSignal for cancellation

        if (error || data.status === "not-found") {
          await trackAuthFailed("sso", "sso-not-found", { ssoId: trackingId });
          await emitter({ result: { key: "not-connected" } });
          return;
        }

        if (data.status === "ok") {
          // Extract and save session
          const { token, sdkJwt, ...authentication } = data.session;
          const session = { ...authentication, token } as Session;

          await jotaiStore.set(addLastAuthenticationAtom, session);
          jotaiStore.set(sessionAtom, session);
          jotaiStore.set(sdkSessionAtom, sdkJwt);

          await trackAuthCompleted("sso", session, { ssoId: trackingId });

          // Emit final connected status
          await emitter({
            result: {
              key: "connected",
              wallet: session.address,
              interactionToken: sdkJwt.token,
            }
          });

          await pushBackupData({ productId });
        }
      } catch (error) {
        if (signal.aborted) return; // Clean cancellation
        console.error("Error tracking SSO", error);
        await emitter({
          error: {
            code: RpcErrorCodes.internalError,
            message: "Failed to track SSO status"
          }
        });
      }
    },
    []
  );
}
```

**SDK Changes:**

**`sdk/core/src/actions/trackSso.ts` (Already updated in 3.2):**
```typescript
export async function* trackSso(
  client: FrakClient,
  args: TrackSsoParamsType,
  signal?: AbortSignal
): AsyncIterableIterator<TrackSsoReturnType> {
  yield* client.rpc.stream('frak_trackSso', [args], signal);
}
```

**React SDK Changes:**

**`sdk/react/src/hook/useTrackSso.ts` (Refactored):**
```typescript
export function useTrackSso({ consumeKey, trackingId }: UseTrackSsoParams) {
  const client = useFrakClient();
  const [status, setStatus] = useState<TrackSsoReturnType | undefined>();
  const [error, setError] = useState<FrakRpcError | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!client || !consumeKey || !trackingId) return;

    const controller = new AbortController();
    setIsLoading(true);

    (async () => {
      try {
        // Use new streaming API
        for await (const result of trackSso(client, {
          consumeKey,
          trackingId
        }, controller.signal)) {
          setStatus(result);

          // Stop loading on final status
          if (result.key !== "not-connected") {
            setIsLoading(false);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err as FrakRpcError);
          setIsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [client, consumeKey, trackingId]);

  return { status, error, isLoading };
}
```

---

## Part 4: Implementation Order & Risk Management

### 4.1 Recommended Implementation Sequence

**Phase 2A: Foundation (1-2 days)**
1. Create `packages/rpc` scaffold
2. Implement `schema.ts` with ResponseType
3. Implement `client.ts` with full test coverage
4. Implement `listener.ts` with full test coverage
5. Add integration tests for client ↔ listener communication

**Phase 2B: SDK Migration (2-3 days)**
1. Update `FrakClient` type with new API
2. Integrate RPC client in `createIFrameFrakClient`
3. Update `watchWalletStatus` to use async iterator
4. Add deprecation warnings to old API
5. Update all action wrappers except SSO
6. Test backward compatibility

**Phase 2C: Wallet Migration (2-3 days)**
1. Update listener.tsx to use new RPC listener
2. Refactor all promise handlers (remove context param)
3. Refactor streaming handlers (add AbortSignal support)
4. Test all RPC methods end-to-end
5. Performance testing (compare before/after)

**Phase 3: SSO Optimization (2-3 days)**
1. Backend API changes (streaming endpoint)
2. Refactor `useOnTrackSso` to use streaming
3. Update `trackSso` SDK action
4. Update `useTrackSso` React hook
5. Integration testing
6. Performance validation (measure reduction in requests)

**Total Estimate:** 7-11 days

### 4.2 Testing Strategy

**Unit Tests:**
- `packages/rpc/client.ts` - Test request(), stream(), cleanup()
- `packages/rpc/listener.ts` - Test handle(), handleStream(), cleanup()
- Mock `postMessage` / `addEventListener` for isolation

**Integration Tests:**
- Test client ↔ listener communication in same process
- Test all 8 RPC methods with new implementation
- Test backward compatibility (old API still works)

**Performance Tests:**
- Measure SSO polling reduction (baseline: 2 req/sec → target: <0.5 req/sec)
- Memory leak testing (ensure cleanup works)
- Re-render count in React hooks (use React DevTools Profiler)

**E2E Tests:**
- Full SSO flow from website → wallet → backend
- Multi-step modal flow
- Concurrent RPC requests

### 4.3 Risk Mitigation

**Risk 1: Breaking Changes**
- **Mitigation:** Keep old API as deprecated wrappers
- **Rollback:** Feature flag to switch between old/new implementation

**Risk 2: React Re-render Cascades**
- **Mitigation:** Thorough profiling before/after
- **Detection:** Add performance monitoring to detect regressions

**Risk 3: Memory Leaks in Streaming**
- **Mitigation:** Comprehensive cleanup testing
- **Detection:** Add memory profiling to CI

**Risk 4: SSO Backend Changes**
- **Mitigation:** Implement streaming support in stages (fallback to polling)
- **Detection:** Feature detection on backend capabilities

---

## Part 5: Files to Modify (Complete List)

### New Files (Phase 2A)

```
packages/rpc/
├── package.json                    # New package definition
├── tsconfig.json                   # TypeScript config
├── src/
│   ├── index.ts                    # Public exports
│   ├── schema.ts                   # Enhanced IFrameRpcSchema
│   ├── client.ts                   # createRpcClient()
│   ├── listener.ts                 # createRpcListener()
│   ├── types.ts                    # Shared types
│   └── utils/
│       ├── deferred.ts             # Deferred promise utility
│       └── channel.ts              # Channel management utilities
```

### Modified Files (Phase 2B - SDK)

**Core Types:**
- `sdk/core/src/types/client.ts` - Add rpc field, deprecate old API
- `sdk/core/src/types/transport.ts` - Add async iterator types
- `sdk/core/src/types/rpc.ts` - Import from @frak-labs/rpc

**Client Implementation:**
- `sdk/core/src/clients/createIFrameFrakClient.ts` - Integrate RPC client
- `sdk/core/src/clients/index.ts` - Export cleanup utilities

**Actions (7 files):**
- `sdk/core/src/actions/watchWalletStatus.ts` - Async iterator
- `sdk/core/src/actions/sendInteraction.ts` - Use rpc.request()
- `sdk/core/src/actions/displayModal.ts` - Use rpc.request()
- `sdk/core/src/actions/openSso.ts` - Use rpc.request()
- `sdk/core/src/actions/trackSso.ts` - Async iterator (streaming)
- `sdk/core/src/actions/getProductInformation.ts` - Use rpc.request()
- `sdk/core/src/actions/displayEmbeddedWallet.ts` - Use rpc.request()

### Modified Files (Phase 2C - Wallet)

**Main Listener:**
- `apps/wallet/app/views/listener.tsx` - Use createRpcListener()

**Request Resolver:**
- `apps/wallet/app/module/sdk/utils/iFrameRequestResolver.ts` - Deprecated/removed

**Promise Handlers (6 files):**
- `apps/wallet/app/module/listener/hooks/useSendInteractionListener.ts`
- `apps/wallet/app/module/listener/hooks/useDisplayModalListener.ts`
- `apps/wallet/app/module/listener/hooks/useOnOpenSso.ts`
- `apps/wallet/app/module/listener/hooks/useOnGetProductInformation.ts`
- `apps/wallet/app/module/listener/hooks/useDisplayEmbeddedWallet.ts`

**Streaming Handlers (2 files):**
- `apps/wallet/app/module/listener/hooks/useWalletStatusListener.ts` - Add AbortSignal
- `apps/wallet/app/module/listener/hooks/useOnTrackSso.ts` - Remove polling, add streaming

### Modified Files (Phase 3 - React SDK)

**React Hooks:**
- `sdk/react/src/hook/useWalletStatus.ts` - Use async iterator
- `sdk/react/src/hook/useTrackSso.ts` - Use async iterator

### Modified Files (Backend - Out of Scope)

**SSO Endpoints:**
- `services/backend/src/routes/auth/sso/consume.ts` - Add streaming support
- (Backend architecture not analyzed in detail)

---

## Part 6: Performance Impact Analysis

### 6.1 Expected Improvements

**SSO Polling Reduction:**
- **Before:** 2 requests/second × average 10s duration = 20 requests per SSO
- **After:** 1-2 requests per SSO (initial + completion)
- **Savings:** 90-95% reduction in backend load for SSO tracking

**Memory Leak Prevention:**
- Current risk: Intervals not cleaned up if channel closes early
- New design: AbortSignal ensures cleanup on cancellation
- Impact: Prevents memory growth in long-running sessions

**React Re-renders:**
- Current: Potential cascade from QueryClient ref changes in useWalletStatusListener
- New: More stable dependencies via explicit AbortSignal handling
- Impact: Reduced unnecessary re-renders (need measurement)

### 6.2 Potential Regressions

**Bundle Size:**
- New `@frak-labs/rpc` package adds code
- Mitigation: Ensure tree-shaking works, measure final bundle
- Target: <5KB gzipped increase

**Async Iterator Overhead:**
- Async generators have slight memory overhead vs callbacks
- Mitigation: Profile memory usage in production
- Expected: Negligible for typical usage patterns

**Type Complexity:**
- Enhanced schema types may slow TypeScript compilation
- Mitigation: Use `as const` assertions, avoid deep conditional types
- Expected: <10% increase in type-checking time

### 6.3 Monitoring Strategy

**Metrics to Track:**
1. **SSO Backend Requests:** requests/sec during SSO flows
2. **Memory Usage:** Browser memory in 1hr+ sessions
3. **React Re-renders:** useWalletStatus hook render count
4. **Bundle Size:** SDK core size before/after
5. **TypeScript Compilation:** Build time before/after

---

## Part 7: Migration Path for External Consumers

### 7.1 SDK Consumers (Breaking Changes)

**Current Code:**
```typescript
// Old callback-based API
await watchWalletStatus(client, (status) => {
  console.log(status);
});
```

**New Code:**
```typescript
// Option 1: Async iterator (recommended)
for await (const status of watchWalletStatus(client)) {
  console.log(status);
}

// Option 2: Callback wrapper (backward compatible)
const cleanup = watchWalletStatusCallback(client, (status) => {
  console.log(status);
});
// Later: cleanup()
```

**React Hooks (No Breaking Changes):**
```typescript
// useWalletStatus() API unchanged
const { data: status } = useWalletStatus();

// useTrackSso() API unchanged, but behavior improved
const { status } = useTrackSso({ consumeKey, trackingId });
```

### 7.2 Deprecation Timeline

**Phase 1 (Immediate):**
- Mark `client.request()` and `client.listenerRequest()` as deprecated
- Add console warnings in development mode
- Update documentation to show new API

**Phase 2 (3 months):**
- Gather telemetry on old API usage
- Reach out to known consumers with migration guide

**Phase 3 (6 months):**
- Remove deprecated APIs in next major version
- Provide codemod for automated migration

---

## Part 8: Open Questions & Decisions Needed

### 8.1 Technical Decisions

**Q1: Should streaming handlers return cleanup functions?**
- Current plan: Use AbortSignal for cleanup signaling
- Alternative: Handler returns `() => void` cleanup function
- **Decision needed:** Approve AbortSignal approach

**Q2: How to handle context (productId, origin) in new handlers?**
- Current plan: Read from Jotai store inside handlers
- Alternative: Pass as explicit parameter (more functional)
- **Concern:** Jotai coupling increases
- **Decision needed:** Accept Jotai coupling or redesign context passing

**Q3: Should we support multiple simultaneous streams for same method?**
- Current: Each channel ID is unique per request
- Scenario: Client calls `watchWalletStatus()` twice
- **Decision needed:** Allow or prevent? If prevent, how?

### 8.2 Backend Coordination

**Q4: Timeline for backend streaming SSO endpoint?**
- Wallet changes can be done independently with polling fallback
- Need coordination with backend team
- **Action needed:** Schedule backend implementation

**Q5: WebSocket vs Long-polling for SSO streaming?**
- Long-polling: Simpler, works everywhere
- WebSocket: More efficient, requires infrastructure
- **Decision needed:** Choose approach based on backend architecture

### 8.3 React SDK Patterns

**Q6: Should useTrackSso auto-start on mount or require explicit trigger?**
- Current: Auto-starts when params provided
- Alternative: Return `start()` function for explicit control
- **Decision needed:** Approve current auto-start behavior

---

## Part 9: Success Criteria

### 9.1 Functional Requirements

- [ ] All 8 RPC methods work with new implementation
- [ ] Backward compatibility: Old SDK API still works
- [ ] No breaking changes to React hooks
- [ ] SSO flow completes successfully
- [ ] Modal flows work (login, session, siwe, transaction)

### 9.2 Performance Requirements

- [ ] SSO backend requests reduced by >80%
- [ ] No memory leaks after 1hr session
- [ ] React re-render count unchanged or improved
- [ ] Bundle size increase <5KB gzipped
- [ ] TypeScript compilation time increase <10%

### 9.3 Quality Requirements

- [ ] >90% test coverage for packages/rpc
- [ ] Integration tests for all RPC methods
- [ ] E2E tests for SSO flow
- [ ] Performance benchmarks before/after
- [ ] Documentation updated (SDK docs + migration guide)

---

## Part 10: Summary & Next Steps

### Current State
- 8 RPC methods implemented with callback-based patterns
- SSO uses inefficient 500ms polling (20+ requests per flow)
- Streaming handlers lack proper cleanup mechanism
- Type safety could be improved with ResponseType field

### Target State
- Modern async iterator API for streaming methods
- Single-request SSO tracking with backend streaming
- Proper AbortSignal-based cleanup
- Enhanced type safety with ResponseType discrimination
- Backward compatible SDK API

### Immediate Next Steps
1. **Approve this plan** - Review and get stakeholder sign-off
2. **Set up packages/rpc** - Create package scaffold, configure build
3. **Implement RPC client** - Build and test core client logic
4. **Coordinate backend** - Schedule backend streaming endpoint work
5. **Start SDK migration** - Begin Phase 2B once Phase 2A is tested

### Key Risks to Watch
- React re-render performance regressions
- Memory leaks in streaming handlers
- Breaking changes for SDK consumers
- Backend coordination delays

---

**Document Status:** Ready for Review
**Author:** Claude Code (Automated Analysis)
**Date:** 2025-09-30
**Next Review:** After stakeholder approval
