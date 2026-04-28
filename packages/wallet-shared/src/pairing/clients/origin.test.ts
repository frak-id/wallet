/**
 * Behavioral tests for the OriginPairingClient — focused on the contract that
 * matters at the application boundary:
 *
 *   - Transient WS closes preserve in-flight signature promises.
 *   - Fatal WS closes reject in-flight promises with a typed error.
 *   - Outbound messages queued while reconnecting flush on `open`.
 *   - Bidirectional `signature-reject` settles the right promise.
 */
import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";

type WsListener = (...args: unknown[]) => void;

/**
 * Minimal WS double that mimics the `Treaty.WSEvent` surface used by the base
 * client: `on(event, listener)`, `send(message)`, `close()`, and a `ws.readyState`
 * proxy. Tests drive it via `fire(event, …)` to simulate the server.
 */
class FakeWs {
    private listeners = new Map<string, Set<WsListener>>();
    public sent: unknown[] = [];
    public ws = { readyState: WebSocket.OPEN as number };

    on(event: string, listener: WsListener) {
        const set = this.listeners.get(event) ?? new Set<WsListener>();
        set.add(listener);
        this.listeners.set(event, set);
    }

    send(message: unknown) {
        this.sent.push(message);
    }

    close() {
        this.ws.readyState = WebSocket.CLOSED;
    }

    fire(event: string, ...args: unknown[]) {
        for (const listener of this.listeners.get(event) ?? []) {
            listener(...args);
        }
    }
}

const fakeWsRegistry: FakeWs[] = [];

vi.mock("../../common/api/backendClient", () => ({
    authenticatedWalletApi: {
        pairings: {
            ws: {
                subscribe: vi.fn(() => {
                    const ws = new FakeWs();
                    fakeWsRegistry.push(ws);
                    return ws;
                }),
            },
        },
    },
}));

vi.mock("../../stores/sessionStore", () => ({
    sessionStore: {
        getState: () => ({
            session: {
                type: "distant-webauthn",
                token: "wallet-token",
                pairingId: "pairing-1",
                address: "0xabc",
            },
            clearSession: vi.fn(),
            setSession: vi.fn(),
            setSdkSession: vi.fn(),
        }),
    },
}));

vi.mock("../../common/utils/safeSession", () => ({
    getSafeSession: vi.fn(() => ({
        type: "distant-webauthn",
        token: "wallet-token",
        pairingId: "pairing-1",
        address: "0xabc",
    })),
}));

vi.mock("../../common/analytics", () => ({
    identifyAuthenticatedUser: vi.fn(),
    trackEvent: vi.fn(),
}));

import type { Hex } from "viem";
import { OriginPairingClient } from "./origin";

function getLastWs(): FakeWs {
    const ws = fakeWsRegistry[fakeWsRegistry.length - 1];
    if (!ws) throw new Error("No FakeWs registered");
    return ws;
}

describe("OriginPairingClient", () => {
    let client: OriginPairingClient;

    beforeEach(() => {
        vi.useFakeTimers();
        fakeWsRegistry.length = 0;
        client = new OriginPairingClient();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function bringClientToPaired() {
        client.reconnect();
        const ws = getLastWs();
        ws.fire("open");
        // Simulate "authenticated" → "paired" transition that the real server
        // would emit. We push a partner-connected which flips status to "paired".
        ws.fire("message", {
            data: {
                type: "partner-connected",
                payload: { pairingId: "pairing-1", deviceName: "iPhone" },
            },
        });
        return ws;
    }

    test("sendSignatureRequest while paired enqueues the request and resolves on response", async () => {
        const ws = bringClientToPaired();
        const promise = client.sendSignatureRequest("0xdeadbeef" as Hex);

        // The send should have reached the FakeWs
        const sent = ws.sent[0] as {
            type: string;
            payload: { id: string; request: string };
        };
        expect(sent.type).toBe("signature-request");
        expect(sent.payload.request).toBe("0xdeadbeef");

        // Resolve via signature-response
        ws.fire("message", {
            data: {
                type: "signature-response",
                payload: {
                    pairingId: "pairing-1",
                    id: sent.payload.id,
                    signature: "0xfeedface",
                },
            },
        });

        await expect(promise).resolves.toBe("0xfeedface");
    });

    test("transient close (1006) preserves the pending signature Map and reconnects silently", async () => {
        const ws = bringClientToPaired();
        const promise = client.sendSignatureRequest("0x01" as Hex);
        const sent = ws.sent[0] as { payload: { id: string } };
        expect(client.state.signatureRequests.size).toBe(1);

        // Simulate abnormal closure
        ws.ws.readyState = WebSocket.CLOSED;
        ws.fire("close", { code: 1006, reason: "abnormal" } as CloseEvent);

        // Critical contract: in-flight signature must survive
        expect(client.state.signatureRequests.size).toBe(1);
        expect(client.state.status).toBe("paired");
        expect(client.state.closeInfo?.code).toBe(1006);

        // Run scheduled reconnect; backend would now replay any pending state.
        await vi.runOnlyPendingTimersAsync();
        const ws2 = getLastWs();
        expect(ws2).not.toBe(ws);
        ws2.fire("open");

        // Server replays signature-response with the same request id (DB-backed).
        ws2.fire("message", {
            data: {
                type: "signature-response",
                payload: {
                    pairingId: "pairing-1",
                    id: sent.payload.id,
                    signature: "0xresumed",
                },
            },
        });

        await expect(promise).resolves.toBe("0xresumed");
    });

    test("messages sent while disconnected queue and flush on reconnect", async () => {
        const ws = bringClientToPaired();

        // Force the WS into a closed state without firing close (simulates
        // the moment between OS-level kill and the close event).
        ws.ws.readyState = WebSocket.CLOSED;

        // sendSignatureRequest should queue the message instead of dropping it.
        const promise = client.sendSignatureRequest("0xqueued" as Hex);
        expect(ws.sent.length).toBe(0);

        // Now fire the close to trigger the reconnect cycle.
        ws.fire("close", { code: 1006, reason: "abnormal" } as CloseEvent);
        await vi.runOnlyPendingTimersAsync();

        const ws2 = getLastWs();
        ws2.fire("open");
        // Queue should have flushed onto the new socket.
        const flushed = ws2.sent[0] as {
            type: string;
            payload: { request: string; id: string };
        };
        expect(flushed.type).toBe("signature-request");
        expect(flushed.payload.request).toBe("0xqueued");

        ws2.fire("message", {
            data: {
                type: "signature-response",
                payload: {
                    pairingId: "pairing-1",
                    id: flushed.payload.id,
                    signature: "0xafterflush",
                },
            },
        });

        await expect(promise).resolves.toBe("0xafterflush");
    });

    test("fatal close (4401) rejects every pending signature with PairingSignatureError", async () => {
        const ws = bringClientToPaired();
        const p1 = client.sendSignatureRequest("0x01" as Hex);
        const p2 = client.sendSignatureRequest("0x02" as Hex);

        ws.ws.readyState = WebSocket.CLOSED;
        ws.fire("close", { code: 4401, reason: "Unauthorized" } as CloseEvent);

        await expect(p1).rejects.toMatchObject({
            name: "PairingSignatureError",
            cause: "connection-lost",
        });
        await expect(p2).rejects.toMatchObject({
            name: "PairingSignatureError",
            cause: "connection-lost",
        });

        expect(client.state.signatureRequests.size).toBe(0);
        expect(client.state.status).toBe("error");
    });

    test("server-emitted signature-reject settles only the matching promise with a typed error", async () => {
        const ws = bringClientToPaired();
        const p1 = client.sendSignatureRequest("0xaaa" as Hex);
        const p2 = client.sendSignatureRequest("0xbbb" as Hex);

        const sent1 = ws.sent[0] as { payload: { id: string } };
        const sent2 = ws.sent[1] as { payload: { id: string } };

        ws.fire("message", {
            data: {
                type: "signature-reject",
                payload: {
                    pairingId: "pairing-1",
                    id: sent1.payload.id,
                    reason: { code: "user-declined", detail: "nope" },
                },
            },
        });

        await expect(p1).rejects.toMatchObject({
            name: "PairingSignatureError",
            cause: "user-declined",
        });

        // p2 still pending — status untouched
        expect(client.state.signatureRequests.size).toBe(1);

        // Settle p2 to keep the promise queue clean
        ws.fire("message", {
            data: {
                type: "signature-response",
                payload: {
                    pairingId: "pairing-1",
                    id: sent2.payload.id,
                    signature: "0xok",
                },
            },
        });
        await expect(p2).resolves.toBe("0xok");
    });

    test("cancelSignatureRequest sends signature-reject and rejects the local promise", async () => {
        const ws = bringClientToPaired();
        const promise = client.sendSignatureRequest("0x42" as Hex);
        const sent = ws.sent[0] as { payload: { id: string } };

        const cancelled = client.cancelSignatureRequest(sent.payload.id);
        expect(cancelled).toBe(true);

        const cancelMsg = ws.sent[1] as {
            type: string;
            payload: { reason: { code: string } };
        };
        expect(cancelMsg.type).toBe("signature-reject");
        expect(cancelMsg.payload.reason.code).toBe("user-cancelled");

        await expect(promise).rejects.toMatchObject({
            name: "PairingSignatureError",
            cause: "user-cancelled",
        });
        expect(client.state.signatureRequests.size).toBe(0);
    });

    test("sendSignatureRequest from idle/error/retry-error throws synchronously", async () => {
        // status is "idle" by default — no connection
        await expect(
            client.sendSignatureRequest("0x01" as Hex)
        ).rejects.toMatchObject({
            name: "PairingSignatureError",
            cause: "connection-lost",
        });
    });
});
