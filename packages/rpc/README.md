# @frak-labs/frame-connector

Type-safe RPC over cross-window `postMessage`, generic over the consumer's own
schema type. No classes, no framework assumptions.

## Message format

```typescript
{
  id: string      // Unique request identifier
  topic: string   // Method name (e.g. 'frak_sendInteraction')
  data: unknown   // Request parameters or response payload
}
```

Each schema entry declares a `ResponseType`: `"promise"` (resolves once) or
`"stream"` (emits repeatedly until unsubscribed).

## Client (SDK side)

```typescript
import { createRpcClient } from "@frak-labs/frame-connector";

const client = createRpcClient<IFrameRpcSchema>({
    emittingTransport: iframe.contentWindow,
    listeningTransport: window,
    targetOrigin: "https://wallet.frak.id",
});

const result = await client.request({
    method: "frak_sendInteraction",
    params: [interaction, { clientId }],
});

const unsubscribe = client.listen(
    { method: "frak_listenToWalletStatus" },
    (status) => setStatus(status)
);

client.sendLifecycle({ clientLifecycle: "heartbeat" });
client.cleanup();
```

`createRpcClient(config)` takes `emittingTransport`, `listeningTransport`,
`targetOrigin`, and optional `middleware` / `lifecycleHandlers`. It returns
exactly four methods: `request`, `listen`, `sendLifecycle`, `cleanup`.

## Listener (wallet side)

```typescript
import { createRpcListener } from "@frak-labs/frame-connector";

const listener = createRpcListener<IFrameRpcSchema>({
    transport: window,
    allowedOrigins: ["https://example.com"],
});

listener.handle("frak_sendInteraction", async (params, context) => {
    const [interaction] = params;
    return { status: "success", hash: await process(interaction) };
});

listener.handleStream("frak_listenToWalletStatus", (params, emit) => {
    emit({ key: "connecting" });
    return walletState.subscribe((state) =>
        emit(
            state.connected
                ? { key: "connected", wallet: state.address }
                : { key: "not-connected" }
        )
    );
});

listener.unregister("frak_sendInteraction");
listener.cleanup();
```

`allowedOrigins` is enforced on every inbound message; anything else is
dropped. Middleware runs on RPC messages only, never on lifecycle events.

## Errors

Rejections are `FrakRpcError` carrying an `RpcErrorCodes` value:

```typescript
try {
    await client.request({ method: "frak_sendInteraction", params });
} catch (error) {
    if (error.code === RpcErrorCodes.userRejected) {
        // ...
    }
}
```
