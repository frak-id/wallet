import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetHostResults } from "@/module/sharing/host/bridge";
import { Route } from "./sharing";

// The param contract itself is tested in
// `app/module/sharing/params/params.test.ts`, against the codec table both
// transports share. What is left here is the route's own behaviour: the guard
// that refuses a host launch with no identity, and how that refusal reaches
// the host.

const beforeLoad = Route.options.beforeLoad as (ctx: {
    search: Record<string, unknown>;
}) => void;

const errorComponent = Route.options.errorComponent as (props: {
    error: Error;
}) => unknown;

describe("/sharing host clientId guard", () => {
    it("rejects an embedded launch with no clientId", () => {
        expect(() => beforeLoad({ search: { embed: "native" } })).toThrow(
            /clientId/
        );
    });

    it("allows an embedded launch that states its clientId", () => {
        expect(() =>
            beforeLoad({ search: { embed: "native", clientId: "c1" } })
        ).not.toThrow();
    });

    it("leaves web callers alone, since they may resolve one later", () => {
        expect(() => beforeLoad({ search: {} })).not.toThrow();
        expect(() =>
            beforeLoad({ search: { checkoutToken: "tok" } })
        ).not.toThrow();
    });
});

describe("/sharing host error hand-off", () => {
    const assign = vi.fn();

    beforeEach(() => {
        resetHostResults();
        assign.mockClear();
        // `location.assign` is non-configurable in jsdom, so it is stubbed
        // wholesale rather than spied on — same approach as `bridge.test.ts`.
        vi.stubGlobal("location", { assign });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("tells the host instead of rendering an error it cannot read", () => {
        // The guard throws; the error component is where the host is told, so
        // the navigation happens once per render rather than once per guard
        // run — and guards re-run whenever the router re-resolves the URL.
        let thrown: Error | undefined;
        try {
            beforeLoad({
                search: {
                    embed: "native",
                    returnScheme: "frak-acme",
                    sid: "s1",
                },
            });
        } catch (error) {
            thrown = error as Error;
        }

        expect(thrown).toBeDefined();
        expect(errorComponent({ error: thrown as Error })).toBeNull();
        expect(assign).toHaveBeenCalledWith(
            "frak-acme://result?action=error&sid=s1"
        );
    });

    it("rethrows anything that is not the guard's own error", () => {
        const other = new Error("something else");
        expect(() => errorComponent({ error: other })).toThrow(other);
    });
});
