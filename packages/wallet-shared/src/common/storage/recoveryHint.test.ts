import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    isTauri: vi.fn(() => false),
}));

// Import after mocks so the module picks them up.
import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { recoveryHintStorage } from "./recoveryHint";

describe("recoveryHintStorage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isTauri).mockReturnValue(false);
    });

    describe("on non-mobile platforms", () => {
        it("get returns an empty hint without invoking the plugin", async () => {
            const hint = await recoveryHintStorage.get();
            expect(hint).toEqual({});
            expect(invokeMock).not.toHaveBeenCalled();
        });

        it("set is a no-op", async () => {
            await recoveryHintStorage.set({ lastAuthenticatorId: "x" });
            expect(invokeMock).not.toHaveBeenCalled();
        });

        it("clear is a no-op", async () => {
            await recoveryHintStorage.clear();
            expect(invokeMock).not.toHaveBeenCalled();
        });
    });

    describe("inside Tauri", () => {
        beforeEach(() => {
            vi.mocked(isTauri).mockReturnValue(true);
        });

        it("get invokes the plugin and returns its payload", async () => {
            invokeMock.mockResolvedValueOnce({
                lastAuthenticatorId: "auth-123",
                lastWallet: "0xabc",
                lastLoginAt: 1700000000000,
            });
            const hint = await recoveryHintStorage.get();
            expect(invokeMock).toHaveBeenCalledWith(
                "plugin:recovery-hint|get_recovery_hint",
                undefined
            );
            expect(hint.lastAuthenticatorId).toBe("auth-123");
        });

        it("get swallows invoke failures", async () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
            invokeMock.mockRejectedValueOnce(new Error("boom"));
            const hint = await recoveryHintStorage.get();
            expect(hint).toEqual({});
            warn.mockRestore();
        });

        it("set sends flat args (not wrapped under `hint`)", async () => {
            // First call is the internal `get` for merge, second is `set`.
            invokeMock.mockResolvedValueOnce({});
            invokeMock.mockResolvedValueOnce(undefined);

            await recoveryHintStorage.set({
                lastAuthenticatorId: "auth-123",
                lastWallet: "0xabc",
                lastLoginAt: 1700000000000,
            });

            expect(invokeMock).toHaveBeenNthCalledWith(
                2,
                "plugin:recovery-hint|set_recovery_hint",
                {
                    lastAuthenticatorId: "auth-123",
                    lastWallet: "0xabc",
                    lastLoginAt: 1700000000000,
                }
            );
        });

        it("set merges with the existing hint", async () => {
            invokeMock.mockResolvedValueOnce({
                lastAuthenticatorId: "old",
                lastWallet: "0xold",
            });
            invokeMock.mockResolvedValueOnce(undefined);

            await recoveryHintStorage.set({ lastLoginAt: 42 });

            expect(invokeMock).toHaveBeenNthCalledWith(
                2,
                "plugin:recovery-hint|set_recovery_hint",
                {
                    lastAuthenticatorId: "old",
                    lastWallet: "0xold",
                    lastLoginAt: 42,
                }
            );
        });

        it("clear invokes the plugin", async () => {
            invokeMock.mockResolvedValueOnce(undefined);
            await recoveryHintStorage.clear();
            expect(invokeMock).toHaveBeenCalledWith(
                "plugin:recovery-hint|clear_recovery_hint",
                undefined
            );
        });
    });
});
