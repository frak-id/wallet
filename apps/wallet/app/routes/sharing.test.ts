import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseInstallSearch } from "@/module/install/params";
import { resetHostResults } from "@/module/sharing/host/bridge";
import { Route, toInstallSearch } from "./sharing";

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
        // `location.assign` is non-configurable in jsdom, so it is stubbed wholesale.
        vi.stubGlobal("location", { assign });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("tells the host instead of rendering an error it cannot read", () => {
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

describe("/sharing → /install forwarding", () => {
    it("carries the checkout token so a Shopify install stays attributed", () => {
        expect(
            toInstallSearch({
                merchantId: "merchant-1",
                checkoutToken: "tok-1",
            })
        ).toEqual({ m: "merchant-1", a: undefined, checkoutToken: "tok-1" });
    });

    it("carries both credentials when the page resolved a clientId too", () => {
        expect(
            toInstallSearch({
                merchantId: "merchant-1",
                clientId: "client-1",
                checkoutToken: "tok-1",
            })
        ).toEqual({
            m: "merchant-1",
            a: "client-1",
            checkoutToken: "tok-1",
        });
    });

    it("stays undefined-valued rather than empty-string when nothing is known", () => {
        expect(toInstallSearch({})).toEqual({
            m: undefined,
            a: undefined,
            checkoutToken: undefined,
        });
    });

    it("hands `/install` a search object its own parser accepts unchanged", () => {
        const search = toInstallSearch({
            merchantId: "merchant-1",
            checkoutToken: "tok-1",
        });

        expect(parseInstallSearch(search)).toMatchObject({
            m: "merchant-1",
            checkoutToken: "tok-1",
        });
    });
});
