import { renderHook } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { useProductScopeTarget } from "./useProductScopeTarget";

describe("useProductScopeTarget", () => {
    it("returns undefined when every prop is undefined", () => {
        const { result } = renderHook(() =>
            useProductScopeTarget(undefined, undefined, undefined)
        );
        expect(result.current).toBeUndefined();
    });

    it("parses a numeric string price", () => {
        const { result } = renderHook(() =>
            useProductScopeTarget(undefined, undefined, "42.5")
        );
        expect(result.current).toEqual({
            productId: undefined,
            sku: undefined,
            unitPrice: 42.5,
        });
    });

    it("passes a numeric price straight through", () => {
        const { result } = renderHook(() =>
            useProductScopeTarget(undefined, undefined, 42.5)
        );
        expect(result.current?.unitPrice).toBe(42.5);
    });

    it("drops an unparseable string price instead of surfacing NaN", () => {
        const { result } = renderHook(() =>
            useProductScopeTarget("prod-1", undefined, "not-a-number")
        );
        expect(result.current).toEqual({
            productId: "prod-1",
            sku: undefined,
            unitPrice: undefined,
        });
    });

    it("builds a target from partial props (productId only)", () => {
        const { result } = renderHook(() =>
            useProductScopeTarget("prod-1", undefined, undefined)
        );
        expect(result.current).toEqual({
            productId: "prod-1",
            sku: undefined,
            unitPrice: undefined,
        });
    });

    it("builds a target from partial props (sku only)", () => {
        const { result } = renderHook(() =>
            useProductScopeTarget(undefined, "SHOE-42", undefined)
        );
        expect(result.current).toEqual({
            productId: undefined,
            sku: "SHOE-42",
            unitPrice: undefined,
        });
    });

    it("builds a target from all props set", () => {
        const { result } = renderHook(() =>
            useProductScopeTarget("prod-1", "SHOE-42", "19.99")
        );
        expect(result.current).toEqual({
            productId: "prod-1",
            sku: "SHOE-42",
            unitPrice: 19.99,
        });
    });
});
