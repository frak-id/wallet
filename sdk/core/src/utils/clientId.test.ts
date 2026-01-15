import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearClientId, getClientId } from "./clientId";

describe("clientId", () => {
    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("getClientId", () => {
        it("should generate and store a new client ID when none exists", () => {
            const clientId = getClientId();

            expect(clientId).toBeDefined();
            expect(clientId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            );
            expect(localStorage.getItem("frak-client-id")).toBe(clientId);
        });

        it("should return existing client ID from localStorage", () => {
            const existingId = "existing-uuid-1234";
            localStorage.setItem("frak-client-id", existingId);

            const clientId = getClientId();

            expect(clientId).toBe(existingId);
        });

        it("should generate consistent UUIDs", () => {
            const id1 = getClientId();
            const id2 = getClientId();

            expect(id1).toBe(id2);
        });
    });

    describe("clearClientId", () => {
        it("should remove client ID from localStorage", () => {
            getClientId(); // Generate and store
            expect(localStorage.getItem("frak-client-id")).toBeDefined();

            clearClientId();

            expect(localStorage.getItem("frak-client-id")).toBeNull();
        });

        it("should handle case when no client ID exists", () => {
            expect(() => clearClientId()).not.toThrow();
        });
    });
});
