import { beforeEach, describe, expect, test } from "vitest";
import { detachedPairingSessionStore } from "./detachedPairingSessionStore";
import type { DetachedPairingSession } from "./types";

const sample = (overrides?: Partial<DetachedPairingSession>) => ({
    pairingId: "pairing-1",
    session: {
        type: "distant-webauthn" as const,
        token: "tok",
        address: "0xabc" as const,
        authenticatorId: "auth-1",
        publicKey: { x: "0x01" as const, y: "0x02" as const },
        pairingId: "pairing-1",
        transports: undefined,
    },
    sdkSession: null,
    ...overrides,
});

describe("detachedPairingSessionStore", () => {
    beforeEach(() => {
        detachedPairingSessionStore.getState().clearDetachedSession();
        if (typeof window !== "undefined") {
            window.sessionStorage.clear();
        }
    });

    test("starts empty", () => {
        expect(detachedPairingSessionStore.getState().detached).toBeNull();
    });

    test("setDetachedSession writes the slot", () => {
        const value = sample();
        detachedPairingSessionStore.getState().setDetachedSession(value);
        expect(detachedPairingSessionStore.getState().detached).toEqual(value);
    });

    test("clearDetachedSession empties the slot", () => {
        detachedPairingSessionStore.getState().setDetachedSession(sample());
        detachedPairingSessionStore.getState().clearDetachedSession();
        expect(detachedPairingSessionStore.getState().detached).toBeNull();
    });

    test("setDetachedSession overwrites the existing slot", () => {
        detachedPairingSessionStore.getState().setDetachedSession(sample());
        const replacement = sample({ pairingId: "pairing-2" });
        detachedPairingSessionStore.getState().setDetachedSession(replacement);
        expect(detachedPairingSessionStore.getState().detached).toEqual(
            replacement
        );
    });

    test("persists to sessionStorage under the expected key", () => {
        detachedPairingSessionStore.getState().setDetachedSession(sample());
        const raw = window.sessionStorage.getItem(
            "frak_detached_pairing_session"
        );
        expect(raw).toBeTruthy();
        expect(JSON.parse(raw ?? "{}")).toMatchObject({
            state: {
                detached: { pairingId: "pairing-1" },
            },
        });
    });
});
