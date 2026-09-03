import type { AnyRouter } from "@tanstack/react-router";
import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { installViewTransitionOptOut, keepsBottomBar } from "./bottomBarRoutes";

const router = createRouter({ routeTree });

const keeps = (from: string, to: string) => keepsBottomBar(router, from, to);

describe("keepsBottomBar", () => {
    it("holds for tab switches", () => {
        expect(keeps("/wallet", "/explorer")).toBe(true);
        expect(keeps("/explorer", "/profile")).toBe(true);
        expect(keeps("/profile", "/wallet")).toBe(true);
    });

    it("holds for non-tab pages sharing the nav layout", () => {
        expect(keeps("/wallet", "/history")).toBe(true);
        expect(keeps("/history", "/settings")).toBe(true);
        expect(keeps("/settings", "/notifications")).toBe(true);
    });

    it("holds for nested pages under the nav layout", () => {
        expect(keeps("/explorer", "/explorer/some-merchant-id")).toBe(true);
    });

    it("fails when the bar is absent on either side", () => {
        expect(keeps("/profile", "/profile/devices")).toBe(false);
        expect(keeps("/profile/devices", "/profile")).toBe(false);
        expect(keeps("/wallet", "/pairing")).toBe(false);
        expect(keeps("/register", "/wallet")).toBe(false);
    });

    it("fails when neither side mounts the bar", () => {
        expect(keeps("/register", "/pairing")).toBe(false);
    });
});

// Stubs `document.startViewTransition`, counting real transitions while `run`
// drives the router. Restores the original before returning.
async function countTransitions(run: () => Promise<void> | void) {
    const started: unknown[] = [];
    const original = document.startViewTransition;
    document.startViewTransition = ((arg: unknown) => {
        started.push(arg);
        if (typeof arg === "function") arg();
        return {
            finished: Promise.resolve(),
            ready: Promise.resolve(),
            updateCallbackDone: Promise.resolve(),
            types: new Set<string>(),
            skipTransition: () => {},
        };
    }) as typeof document.startViewTransition;

    try {
        await run();
    } finally {
        document.startViewTransition = original;
    }
    return started.length;
}

function createAppRouter() {
    const appRouter = createRouter({ routeTree, defaultViewTransition: true });
    // Simulate WebKit below 18.2, where `defaultViewTransition.types` is never
    // consulted. The opt-out must hold without it.
    appRouter.isViewTransitionTypesSupported = false;
    installViewTransitionOptOut(appRouter);
    return appRouter;
}

// `resolvedLocation` is written only by `Transitioner`'s layout effect, so
// without a mounted `<RouterProvider>` it stays `undefined` and the router
// cannot be navigated for real. Pin both locations to drive the guard.
function pinLocations(appRouter: AnyRouter, from: string, to: string) {
    appRouter.stores.resolvedLocation.set({
        ...appRouter.latestLocation,
        pathname: from,
    });
    appRouter.latestLocation = { ...appRouter.latestLocation, pathname: to };
}

describe("view transition opt-out", () => {
    it("consumes the flag rather than stranding it", async () => {
        const appRouter = createAppRouter();
        await countTransitions(() => appRouter.load());
        expect(appRouter.shouldViewTransition).toBeUndefined();
    });

    it("skips a navigation that keeps the tab bar mounted", async () => {
        const appRouter = createAppRouter();
        await appRouter.load();
        pinLocations(appRouter, "/wallet", "/explorer");
        expect(
            await countTransitions(() =>
                appRouter.startViewTransition(async () => {})
            )
        ).toBe(0);
    });

    it("skips a same-path navigation", async () => {
        const appRouter = createAppRouter();
        await appRouter.load();
        pinLocations(appRouter, "/wallet", "/wallet");
        expect(
            await countTransitions(() =>
                appRouter.startViewTransition(async () => {})
            )
        ).toBe(0);
    });

    // Control for all three skips above: identical wiring, a pair that should
    // animate. Without it a guard that suppressed everything would pass.
    it("still transitions when the bar is not preserved", async () => {
        const appRouter = createAppRouter();
        await appRouter.load();
        pinLocations(appRouter, "/wallet", "/pairing");
        expect(
            await countTransitions(() =>
                appRouter.startViewTransition(async () => {})
            )
        ).toBe(1);
    });

    // Boot asserts wiring, not boot semantics: `resolvedLocation` is unset
    // without a mounted provider, so `!from` is trivially true here. The
    // tab-switch case above is what discriminates the real fix.
    it("does not transition before the first location resolves", async () => {
        const appRouter = createAppRouter();
        expect(appRouter.stores.resolvedLocation.get()).toBeUndefined();
        expect(await countTransitions(() => appRouter.load())).toBe(0);
    });
});
