import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `getClientId`/`initClientId` share a module-level cache by design (README
 * §2.1). Each test re-imports the module fresh via `vi.resetModules()` so a
 * populated cache from one test can never leak into the next, regardless of
 * run order.
 */
async function freshClientIdModule() {
    vi.resetModules();
    return import("./clientId");
}

describe("clientId", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("getClientId", () => {
        it("should generate and store a new client ID when none exists", async () => {
            const { getClientId } = await freshClientIdModule();
            const clientId = getClientId();

            expect(clientId).toBeDefined();
            expect(clientId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            );
            expect(localStorage.getItem("frak-client-id")).toBe(clientId);
        });

        it("should return existing client ID from localStorage", async () => {
            const existingId = "existing-uuid-1234";
            localStorage.setItem("frak-client-id", existingId);

            const { getClientId } = await freshClientIdModule();
            const clientId = getClientId();

            expect(clientId).toBe(existingId);
        });

        it("should generate consistent UUIDs", async () => {
            const { getClientId } = await freshClientIdModule();
            const id1 = getClientId();
            const id2 = getClientId();

            expect(id1).toBe(id2);
        });

        it("falls back to the cold synchronous path when called before initClientId resolves (§2.1 edge case)", async () => {
            // No setupClient/createIframe involved — e.g. a standalone action
            // import. getClientId() must still return a usable id, not throw
            // or block.
            const { getClientId } = await freshClientIdModule();
            const clientId = getClientId();

            expect(clientId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            );
        });
    });

    describe("initClientId", () => {
        it("populates the module cache so getClientId reads the derived id afterwards", async () => {
            const { getClientId, initClientId } = await freshClientIdModule();
            const derivedId = await initClientId();

            expect(getClientId()).toBe(derivedId);
            expect(derivedId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            );
        });

        it("is idempotent — concurrent calls resolve to the same id", async () => {
            const { initClientId } = await freshClientIdModule();
            const [first, second] = await Promise.all([
                initClientId(),
                initClientId(),
            ]);

            expect(first).toBe(second);
        });

        it("cold getClientId calls before init still resolve, and init later derives over them", async () => {
            const { getClientId, initClientId } = await freshClientIdModule();

            const coldId = getClientId();
            expect(coldId).toBeTruthy();

            // The cold path never generates a key, so its id is a legacy
            // one. `initClientId` derives a provable id over it and schedules
            // the migration merge (§2.6), rather than keeping the legacy id.
            const derivedId = await initClientId();
            expect(derivedId).not.toBe(coldId);
            expect(localStorage.getItem("frak-client-id")).toBe(derivedId);
            expect(localStorage.getItem("frak-client-id-legacy")).toBe(coldId);

            // Later synchronous reads see the derived id, so the iframe and
            // every `x-frak-client-id` header agree from here on.
            expect(getClientId()).toBe(derivedId);
        });
    });
});
