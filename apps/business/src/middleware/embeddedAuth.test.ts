import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/authStore";
import { isEmbeddedAuthenticated, requireEmbeddedAuth } from "./embeddedAuth";

vi.mock("@tanstack/react-router", () => ({
    redirect: vi.fn((options) => {
        throw new Error(`Redirect to ${options.to}`);
    }),
}));

describe("embeddedAuth middleware", () => {
    beforeEach(() => {
        useAuthStore.setState({
            token: null,
            wallet: null,
            expiresAt: null,
        });
    });

    describe("isEmbeddedAuthenticated", () => {
        it("should return false when not authenticated", () => {
            expect(isEmbeddedAuthenticated()).toBe(false);
        });

        it("should return true when authenticated with valid token", () => {
            const futureTime = Date.now() + 1000 * 60 * 60; // 1 hour from now
            useAuthStore.setState({
                token: "valid-token",
                wallet: "0x1234567890123456789012345678901234567890",
                expiresAt: futureTime,
            });

            expect(isEmbeddedAuthenticated()).toBe(true);
        });

        it("should return false when token is expired", () => {
            const pastTime = Date.now() - 1000; // 1 second ago
            useAuthStore.setState({
                token: "expired-token",
                wallet: "0x1234567890123456789012345678901234567890",
                expiresAt: pastTime,
            });

            expect(isEmbeddedAuthenticated()).toBe(false);
        });
    });

    describe("requireEmbeddedAuth", () => {
        it("should redirect to auth page when not authenticated", async () => {
            const location = { href: "/embedded/_layout/mint" };

            await expect(requireEmbeddedAuth({ location })).rejects.toThrow(
                "Redirect to /embedded/auth"
            );
        });

        it("should not redirect when authenticated", async () => {
            const futureTime = Date.now() + 1000 * 60 * 60;
            useAuthStore.setState({
                token: "valid-token",
                wallet: "0x1234567890123456789012345678901234567890",
                expiresAt: futureTime,
            });

            const location = { href: "/embedded/_layout/mint" };

            await expect(
                requireEmbeddedAuth({ location })
            ).resolves.toBeUndefined();
        });
    });
});
