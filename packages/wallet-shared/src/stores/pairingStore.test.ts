import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../tests/vitest-fixtures";
import { getValidPendingPairingId, pairingStore } from "./pairingStore";

const PENDING_PAIRING_TTL_MS = 5 * 60 * 1000;

describe("pairingStore", () => {
    beforeEach(() => {
        sessionStorage.clear();
        pairingStore.getState().clearPendingPairing();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-02-04T00:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("should set pending pairing when setPendingPairingId is called", () => {
        pairingStore.getState().setPendingPairingId("pair-1");

        const state = pairingStore.getState();

        expect(state.pendingPairingId).toBe("pair-1");
        expect(state.pendingPairingExpiresAt).toBe(
            Date.now() + PENDING_PAIRING_TTL_MS
        );
    });

    test("should clear pending pairing when expired", () => {
        pairingStore.getState().setPendingPairingId("pair-1");

        vi.advanceTimersByTime(PENDING_PAIRING_TTL_MS + 1);

        const validId = getValidPendingPairingId();
        const state = pairingStore.getState();

        expect(validId).toBeNull();
        expect(state.pendingPairingId).toBeNull();
        expect(state.pendingPairingExpiresAt).toBeNull();
    });

    test("should clear pending pairing when clearPendingPairing is called", () => {
        pairingStore.getState().setPendingPairingId("pair-1");

        pairingStore.getState().clearPendingPairing();

        const state = pairingStore.getState();

        expect(state.pendingPairingId).toBeNull();
        expect(state.pendingPairingExpiresAt).toBeNull();
    });
});
