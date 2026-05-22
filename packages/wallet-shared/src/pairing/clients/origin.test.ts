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

type SafeSession =
    | { type: string; token: string; pairingId: string; address: string }
    | undefined;

// Hoisted block: vi.mock factories run before any top-level statement, so
// any reference they capture must be created via vi.hoisted().
const { subscribeMock, mockedSafeSession } = vi.hoisted(() => ({
    subscribeMock: vi.fn(
        (_args?: { query?: Record<string, unknown> }): unknown => undefined
    ),
    mockedSafeSession: vi.fn<() => SafeSession>(() => undefined),
}));

// Wire the FakeWs factory in here so the FakeWs class is in scope. Tests
// reset the implementation before/after as needed.
subscribeMock.mockImplementation(() => {
    const ws = new FakeWs();
    fakeWsRegistry.push(ws);
    return ws;
});

vi.mock("../../common/api/backendClient", () => ({
    authenticatedWalletApi: {
        pairings: {
            ws: {
                subscribe: subscribeMock,
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
            sdkSession: null,
            clearSession: vi.fn(),
            setSession: vi.fn(),
            setSdkSession: vi.fn(),
            parkSession: vi.fn(() => true),
            popSession: vi.fn(() => false),
            discardPreviousSession: vi.fn(() => false),
        }),
    },
}));

vi.mock("../../common/utils/safeSession", () => ({
    getSafeSession: mockedSafeSession,
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
        // Reset to the default authenticated mock; individual tests opt out.
        mockedSafeSession.mockImplementation(() => ({
            type: "distant-webauthn",
            token: "wallet-token",
            pairingId: "pairing-1",
            address: "0xabc",
        }));
        // Clear sessionStorage so persisted pairing from prior tests doesn't
        // leak (the persist middleware reads it during construction).
        if (typeof window !== "undefined") {
            window.sessionStorage.clear();
        }
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

    test("reconnect with no session but in-flight pairing uses the resume action", () => {
        // Simulate the slow-pairing scenario: pairing-initiated arrived but
        // target hasn't authenticated yet, so no session exists.
        mockedSafeSession.mockImplementation(() => undefined);

        // Seed the in-flight pairing state (as if pairing-initiated had been
        // received before the WS dropped).
        client.store.setState((prev) => ({
            ...prev,
            status: "connecting",
            pairing: {
                id: "pairing-1",
                code: "123456",
                originResumeToken: "resume-token-xyz",
            },
        }));

        subscribeMock.mockClear();
        client.reconnect();

        expect(subscribeMock).toHaveBeenCalledTimes(1);
        const lastCall = subscribeMock.mock.calls[0];
        expect(lastCall?.[0]?.query).toEqual({
            action: "resume",
            originResumeToken: "resume-token-xyz",
        });
    });

    test("reconnect without session or pending pairing bails without opening a WS", () => {
        mockedSafeSession.mockImplementation(() => undefined);
        subscribeMock.mockClear();

        client.reconnect();
        expect(subscribeMock).not.toHaveBeenCalled();
    });

    test("authenticated message clears the persisted pairing state", () => {
        const ws = bringClientToPaired();
        // Seed a pairing in state to simulate having gone through pairing-initiated.
        client.store.setState((prev) => ({
            ...prev,
            pairing: {
                id: "pairing-1",
                code: "123456",
                originResumeToken: "resume-token-xyz",
            },
        }));
        expect(client.state.pairing).toBeDefined();

        ws.fire("message", {
            data: {
                type: "authenticated",
                payload: {
                    token: "wallet-token",
                    sdkJwt: { token: "sdk-jwt", expires: 0 },
                    wallet: {
                        type: "distant-webauthn",
                        address: "0xabc",
                        authenticatorId: "auth-1",
                        publicKey: { x: "0x01", y: "0x02" },
                        transports: undefined,
                        pairingId: "pairing-1",
                    },
                },
            },
        });

        expect(client.state.pairing).toBeUndefined();
    });

    test("RESUME_TOKEN_EXPIRED close auto-reinitiates with the last options", async () => {
        // 1. Component calls initiatePairing — stashes options on the client.
        await client.initiatePairing();
        const ws = getLastWs();
        ws.fire("open");
        ws.fire("message", {
            data: {
                type: "pairing-initiated",
                payload: {
                    pairingId: "pairing-1",
                    pairingCode: "123456",
                    originResumeToken: "resume-token-xyz",
                },
            },
        });
        expect(client.state.pairing).toBeDefined();

        // 2. WS dies, then resume attempt fails because the token aged out.
        ws.ws.readyState = WebSocket.CLOSED;
        subscribeMock.mockClear();
        ws.fire("close", {
            code: 4407,
            reason: "Invalid or expired resume token",
        } as CloseEvent);

        // 3. Auto-reinitiate is queued via microtask — flush it.
        await Promise.resolve();

        // 4. A fresh `action=initiate` WS should have been opened.
        expect(subscribeMock).toHaveBeenCalledTimes(1);
        expect(subscribeMock.mock.calls[0]?.[0]?.query).toMatchObject({
            action: "initiate",
        });
        // 5. State is NOT in "error" — the close was consumed silently.
        expect(client.state.status).not.toBe("error");
    });

    test("RESUME_TOKEN_EXPIRED with no stashed options falls through to error state", () => {
        // No initiatePairing() call — e.g. tab refresh + auto-resume from
        // sessionStorage that races a server-side TTL expiry.
        mockedSafeSession.mockImplementation(() => undefined);
        client.store.setState((prev) => ({
            ...prev,
            status: "connecting",
            pairing: {
                id: "pairing-1",
                code: "123456",
                originResumeToken: "resume-token-xyz",
            },
        }));
        client.reconnect();
        const ws = getLastWs();
        ws.ws.readyState = WebSocket.CLOSED;
        ws.fire("close", {
            code: 4407,
            reason: "Pairing not found",
        } as CloseEvent);

        expect(client.state.status).toBe("error");
        expect(client.state.pairing).toBeUndefined();
    });
});
