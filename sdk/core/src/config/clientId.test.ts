import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `getClientId`/`initClientId` share a module-level cache by design. Each
 * test re-imports the module fresh via `vi.resetModules()` so a populated
 * cache from one test can never leak into the next, regardless of run
 * order.
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
        // `restoreAllMocks` does NOT undo `stubGlobal`, and the no-entropy
        // tests stub `crypto` away — without this they leak into every later
        // test in the file.
        vi.unstubAllGlobals();
    });

    describe("getClientId", () => {
        it("returns undefined on a cold cache, and never mints an id", async () => {
            const { getClientId, getClientIdAsync } =
                await freshClientIdModule();

            expect(getClientId()).toBeUndefined();
            // Crucially: nothing was persisted.
            expect(localStorage.getItem("frak-client-id")).toBeNull();

            // Drain the derivation the cold read scheduled — it writes to
            // localStorage and would otherwise land mid a later test.
            await getClientIdAsync();
        });

        it("does NOT return a stored id that has no key beside it", async () => {
            // A bare id with no `frak-client-key` is a legacy id. It must not
            // be handed out as-is: only derived, provable ids are returned.
            localStorage.setItem("frak-client-id", "existing-uuid-1234");

            const { getClientId, getClientIdAsync } =
                await freshClientIdModule();

            expect(getClientId()).toBeUndefined();

            await getClientIdAsync();
        });

        it("schedules derivation in the background so a later read succeeds", async () => {
            const { getClientId } = await freshClientIdModule();

            expect(getClientId()).toBeUndefined();

            // The cold read kicked off derivation; capture the value inside
            // the poll — reading again afterwards could observe a different call.
            let derived: string | undefined;
            await vi.waitFor(() => {
                derived = getClientId();
                expect(derived).toBeDefined();
            });

            expect(derived).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            );
            expect(localStorage.getItem("frak-client-id")).toBe(derived);
            expect(localStorage.getItem("frak-client-key")).not.toBeNull();
        });

        it("is stable across calls once derived", async () => {
            const { getClientId, initClientId } = await freshClientIdModule();
            await initClientId();

            expect(getClientId()).toBe(getClientId());
        });

        it("does not produce an unhandled rejection when derivation is impossible", async () => {
            const onUnhandled = vi.fn();
            window.addEventListener("unhandledrejection", onUnhandled);
            // No entropy source ⇒ ensureIdentityKey rejects.
            vi.stubGlobal("crypto", {});

            const { getClientId } = await freshClientIdModule();
            expect(getClientId()).toBeUndefined();

            await new Promise((resolve) => setTimeout(resolve, 10));
            expect(onUnhandled).not.toHaveBeenCalled();
            window.removeEventListener("unhandledrejection", onUnhandled);
        });
    });

    describe("getClientIdAsync", () => {
        it("derives an id without any setupClient call", async () => {
            const { getClientIdAsync } = await freshClientIdModule();

            const clientId = await getClientIdAsync();

            expect(clientId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            );
        });

        it("joins one in-flight derivation instead of generating per caller", async () => {
            const { getClientIdAsync } = await freshClientIdModule();

            const ids = await Promise.all([
                getClientIdAsync(),
                getClientIdAsync(),
                getClientIdAsync(),
                getClientIdAsync(),
            ]);

            // One keygen: every caller sees the same id, and only one key was
            // ever written.
            expect(new Set(ids).size).toBe(1);
        });

        it("rejects rather than resolving an unprovable id", async () => {
            vi.stubGlobal("crypto", {});
            const { getClientIdAsync } = await freshClientIdModule();

            await expect(getClientIdAsync()).rejects.toThrow();
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

        it("derives over a pre-existing legacy id and flags it for migration", async () => {
            const { getClientId, initClientId } = await freshClientIdModule();
            localStorage.setItem("frak-client-id", "legacy-random-id");

            const derivedId = await initClientId();

            expect(derivedId).not.toBe("legacy-random-id");
            expect(localStorage.getItem("frak-client-id")).toBe(derivedId);
            expect(localStorage.getItem("frak-client-id-legacy")).toBe(
                "legacy-random-id"
            );

            // Later synchronous reads see the derived id, so the iframe and
            // every `x-frak-client-id` header agree from here on.
            expect(getClientId()).toBe(derivedId);
        });

        it("caches a rejection instead of retrying keygen on every call", async () => {
            vi.stubGlobal("crypto", {});
            const { initClientId } = await freshClientIdModule();

            const firstError = await initClientId().catch((e) => e);
            const secondError = await initClientId().catch((e) => e);

            // Same error instance proves the promise was reused, not
            // re-derived (comparing the wrapper promises would always differ).
            expect(firstError).toBeInstanceOf(Error);
            expect(firstError).toBe(secondError);
        });
    });
});
