/**
 * Behavioral tests for the TargetPairingClient — focused on the bidirectional
 * `signature-reject` handling. Origin-side cancellations and server-emitted
 * rejections (TTL expiry) all flow through the same WS message and must remove
 * the request from the wallet's pending UI without throwing.
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
                type: "webauthn",
                token: "wallet-token",
                address: "0xabc",
                authenticatorId: "auth",
                publicKey: { x: "0x1", y: "0x2" },
            },
            clearSession: vi.fn(),
        }),
    },
}));

vi.mock("../../common/utils/safeSession", () => ({
    getSafeSession: vi.fn(() => ({
        type: "webauthn",
        token: "wallet-token",
        address: "0xabc",
    })),
}));

import { TargetPairingClient } from "./target";

function getLastWs(): FakeWs {
    const ws = fakeWsRegistry[fakeWsRegistry.length - 1];
    if (!ws) throw new Error("No FakeWs registered");
    return ws;
}

describe("TargetPairingClient", () => {
    let client: TargetPairingClient;

    beforeEach(() => {
        vi.useFakeTimers();
        fakeWsRegistry.length = 0;
        client = new TargetPairingClient();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function bringTargetOnline() {
        client.reconnect();
        const ws = getLastWs();
        ws.fire("open");
        return ws;
    }

    function pushSignatureRequest(ws: FakeWs, id: string, pairingId: string) {
        ws.fire("message", {
            data: {
                type: "signature-request",
                payload: {
                    id,
                    pairingId,
                    request: `0x${id}`,
                    partnerDeviceName: "Desktop",
                },
            },
        });
    }

    test("server-emitted signature-reject removes the request from pendingSignatures", () => {
        const ws = bringTargetOnline();
        pushSignatureRequest(ws, "req-1", "pairing-1");
        pushSignatureRequest(ws, "req-2", "pairing-1");
        expect(client.state.pendingSignatures.size).toBe(2);

        ws.fire("message", {
            data: {
                type: "signature-reject",
                payload: {
                    id: "req-1",
                    pairingId: "pairing-1",
                    reason: { code: "user-cancelled" },
                },
            },
        });

        expect(client.state.pendingSignatures.size).toBe(1);
        expect(client.state.pendingSignatures.has("req-2")).toBe(true);
    });

    test("signature-reject for an unknown id is a no-op (idempotent)", () => {
        const ws = bringTargetOnline();
        pushSignatureRequest(ws, "req-1", "pairing-1");

        ws.fire("message", {
            data: {
                type: "signature-reject",
                payload: {
                    id: "unknown",
                    pairingId: "pairing-1",
                    reason: { code: "expired" },
                },
            },
        });

        expect(client.state.pendingSignatures.size).toBe(1);
    });

    test("transient close preserves pendingSignatures", () => {
        const ws = bringTargetOnline();
        pushSignatureRequest(ws, "req-1", "pairing-1");
        expect(client.state.pendingSignatures.size).toBe(1);

        ws.ws.readyState = WebSocket.CLOSED;
        ws.fire("close", { code: 1006, reason: "abnormal" } as CloseEvent);

        // Pending UI must survive the disconnect.
        expect(client.state.pendingSignatures.size).toBe(1);
        expect(client.state.closeInfo?.code).toBe(1006);
    });

    test("fatal close clears pendingSignatures so the UI doesn't show stale prompts", () => {
        const ws = bringTargetOnline();
        pushSignatureRequest(ws, "req-1", "pairing-1");

        ws.ws.readyState = WebSocket.CLOSED;
        ws.fire("close", { code: 4401, reason: "Unauthorized" } as CloseEvent);

        expect(client.state.pendingSignatures.size).toBe(0);
        expect(client.state.status).toBe("error");
    });
});
