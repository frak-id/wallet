import { beforeEach, describe, expect, it } from "vitest";
import { useTwoFactorStore } from "./twoFactorStore";

describe("twoFactorStore", () => {
    beforeEach(() => {
        useTwoFactorStore.setState({
            request: null,
            pendingLoginMethods: null,
        });
    });

    describe("requestVerification / resolveVerification", () => {
        it("opens a request and resolves true on success", async () => {
            const promise = useTwoFactorStore
                .getState()
                .requestVerification(["email", "totp"]);

            expect(useTwoFactorStore.getState().request?.methods).toEqual([
                "email",
                "totp",
            ]);

            useTwoFactorStore.getState().resolveVerification();

            await expect(promise).resolves.toBe(true);
            expect(useTwoFactorStore.getState().request).toBeNull();
        });
    });

    describe("cancelVerification", () => {
        it("resolves false and clears the request", async () => {
            const promise = useTwoFactorStore
                .getState()
                .requestVerification(["siwe"]);

            useTwoFactorStore.getState().cancelVerification();

            await expect(promise).resolves.toBe(false);
            expect(useTwoFactorStore.getState().request).toBeNull();
        });
    });

    describe("concurrent requests", () => {
        it("reuses the pending request and resolves every caller together", async () => {
            const first = useTwoFactorStore
                .getState()
                .requestVerification(["email"]);
            const second = useTwoFactorStore
                .getState()
                .requestVerification(["email"]);

            // Only one modal-worth of state — the second call must not
            // replace the in-flight request's methods.
            expect(useTwoFactorStore.getState().request?.methods).toEqual([
                "email",
            ]);

            useTwoFactorStore.getState().resolveVerification();

            await expect(first).resolves.toBe(true);
            await expect(second).resolves.toBe(true);
        });
    });

    describe("pendingLoginMethods", () => {
        it("is set then consumed exactly once", () => {
            useTwoFactorStore.getState().setPendingLoginMethods(["email"]);
            expect(useTwoFactorStore.getState().pendingLoginMethods).toEqual([
                "email",
            ]);

            const consumed = useTwoFactorStore
                .getState()
                .consumePendingLoginMethods();
            expect(consumed).toEqual(["email"]);
            expect(useTwoFactorStore.getState().pendingLoginMethods).toBeNull();

            expect(
                useTwoFactorStore.getState().consumePendingLoginMethods()
            ).toBeNull();
        });
    });
});
