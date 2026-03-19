import { describe, expect, it } from "vitest";
import { easing, fontSize, shadow, transition, zIndex } from "./tokens.css";

describe("design-system tokens", () => {
    describe("zIndex", () => {
        it("should have correct z-index values matching wallet-tokens.css", () => {
            expect(zIndex.dropdown).toBe(100);
            expect(zIndex.sticky).toBe(200);
            expect(zIndex.fixed).toBe(500);
            expect(zIndex.modal).toBe(1000);
            expect(zIndex.popover).toBe(1100);
            expect(zIndex.toast).toBe(9999);
        });
    });

    describe("transition", () => {
        it("should have correct transition durations", () => {
            expect(transition.fast).toBe("0.15s");
            expect(transition.base).toBe("0.2s");
            expect(transition.slow).toBe("0.3s");
        });
    });

    describe("easing", () => {
        it("should have correct easing values", () => {
            expect(easing.default).toBe("ease");
            expect(easing.inOut).toBe("ease-in-out");
            expect(easing.smooth).toBe("cubic-bezier(0.25, 0.1, 0.25, 1)");
            expect(easing.decelerate).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
        });
    });

    describe("shadow", () => {
        it("should have panel shadow matching wallet-tokens.css", () => {
            expect(shadow.panel).toBe("4px 4px 4px 0 rgba(0,0,0,0.08)");
        });
    });

    describe("fontSize", () => {
        it("should have correct font size values matching alias-fontsize-* CSS vars", () => {
            expect(fontSize.xs).toBe("12px");
            expect(fontSize.s).toBe("14px");
            expect(fontSize.m).toBe("16px");
            expect(fontSize.l).toBe("18px");
            expect(fontSize.xl).toBe("24px");
            expect(fontSize["2xl"]).toBe("34px");
            expect(fontSize["3xl"]).toBe("40px");
        });
    });
});
