import { describe, expect, it } from "vitest";
import {
    alias,
    easing,
    fontSize,
    semanticDark,
    semanticLight,
    shadow,
    transition,
    zIndex,
} from "./tokens.css";

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
        it("should have correct font size values", () => {
            expect(fontSize.xs).toBe("12px");
            expect(fontSize.s).toBe("14px");
            expect(fontSize.m).toBe("16px");
            expect(fontSize.l).toBe("18px");
            expect(fontSize.xl).toBe("20px");
            expect(fontSize["2xl"]).toBe("24px");
            expect(fontSize["3xl"]).toBe("28px");
            expect(fontSize["4xl"]).toBe("32px");
            expect(fontSize["5xl"]).toBe("40px");
            expect(fontSize["6xl"]).toBe("48px");
        });
    });

    // Behavior-preserving guard for the token-derivation refactor. These
    // values were captured from the pre-refactor literal maps in
    // tokens.css.ts. They must keep passing after `alias` and `semantic*`
    // are rewired to reference `brand.colors.*` — a green suite here proves
    // the refactor changed nothing observable.
    describe("alias colors (behavior-preserving guard)", () => {
        it("should have correct alias.neutral values", () => {
            expect(alias.neutral[50]).toBe("#f9fafb");
            expect(alias.neutral[100]).toBe("#f7f7f7");
            expect(alias.neutral[200]).toBe("#f5f5f5");
            expect(alias.neutral[250]).toBe("#e2e2e2");
            expect(alias.neutral[300]).toBe("#d4d4d4");
            expect(alias.neutral[400]).toBe("#a3a3a3");
            expect(alias.neutral[500]).toBe("#737373");
            expect(alias.neutral[600]).toBe("#525252");
            expect(alias.neutral[700]).toBe("#262626");
            expect(alias.neutral.white).toBe("#ffffff");
            expect(alias.neutral.overlay).toBe("#000000b2");
            expect(alias.neutral.default).toBe("#000000");
        });

        it("should have correct alias.primary values", () => {
            expect(alias.primary[50]).toBe("#f2f6fe");
            expect(alias.primary[100]).toBe("#e5ecfd");
            expect(alias.primary[200]).toBe("#ccd9fc");
            expect(alias.primary[300]).toBe("#99b4f9");
            expect(alias.primary[400]).toBe("#668ef5");
            expect(alias.primary[500]).toBe("#3369f2");
            expect(alias.primary[700]).toBe("#0036bf");
            expect(alias.primary[800]).toBe("#00288f");
            expect(alias.primary.default).toBe("#0043ef");
        });

        it("should have correct alias.success values", () => {
            expect(alias.success[50]).toBe("#f3fcf7");
            expect(alias.success[100]).toBe("#e6f8f0");
            expect(alias.success[200]).toBe("#cef2e1");
            expect(alias.success[300]).toBe("#9de5c2");
            expect(alias.success[400]).toBe("#6bd8a4");
            expect(alias.success[500]).toBe("#3acb85");
            expect(alias.success[700]).toBe("#079852");
            expect(alias.success[800]).toBe("#05723e");
            expect(alias.success.default).toBe("#09be67");
        });

        it("should have correct alias.warning values", () => {
            expect(alias.warning[50]).toBe("#fef9f2");
            expect(alias.warning[100]).toBe("#fdf2e5");
            expect(alias.warning[200]).toBe("#fbe5cc");
            expect(alias.warning[300]).toBe("#f7cb99");
            expect(alias.warning[400]).toBe("#f4b266");
            expect(alias.warning[500]).toBe("#f09833");
            expect(alias.warning[700]).toBe("#bd6500");
            expect(alias.warning[800]).toBe("#8e4c00");
            expect(alias.warning.default).toBe("#ec7e00");
        });

        it("should have correct alias.error values", () => {
            expect(alias.error[50]).toBe("#fef4f5");
            expect(alias.error[100]).toBe("#fce8ea");
            expect(alias.error[200]).toBe("#f9d2d6");
            expect(alias.error[300]).toBe("#f4a4ac");
            expect(alias.error[400]).toBe("#ee7783");
            expect(alias.error[500]).toBe("#e9495a");
            expect(alias.error[700]).toBe("#b61627");
            expect(alias.error[800]).toBe("#88111d");
            expect(alias.error.default).toBe("#e31c31");
        });
    });

    describe("semanticLight (behavior-preserving guard)", () => {
        it("should have correct text values", () => {
            expect(semanticLight.text.primary).toBe("#000000");
            expect(semanticLight.text.secondary).toBe("#525252");
            expect(semanticLight.text.tertiary).toBe("#a3a3a3");
            expect(semanticLight.text.disabled).toBe("#a3a3a3");
            expect(semanticLight.text.action).toBe("#0043ef");
            expect(semanticLight.text.actionHover).toBe("#0036bf");
            expect(semanticLight.text.onAction).toBe("#ffffff");
            expect(semanticLight.text.error).toBe("#e31c31");
            expect(semanticLight.text.success).toBe("#09be67");
            expect(semanticLight.text.warning).toBe("#ec7e00");
        });

        it("should have correct surface values", () => {
            expect(semanticLight.surface.primary).toBe("#0043ef");
            expect(semanticLight.surface.secondary).toBe("#f2f6fe");
            expect(semanticLight.surface.background).toBe("#ffffff");
            expect(semanticLight.surface.background2).toBe("#f9fafb");
            expect(semanticLight.surface.elevated).toBe("#ffffff");
            expect(semanticLight.surface.muted).toBe("#f7f7f7");
            expect(semanticLight.surface.tertiary).toBe("#f7f7f7");
            expect(semanticLight.surface.overlay).toBe("#000000b2");
            expect(semanticLight.surface.disabled).toBe("#e2e2e2");
            expect(semanticLight.surface.primaryHover).toBe("#0036bf");
            expect(semanticLight.surface.primaryPressed).toBe("#00288f");
            expect(semanticLight.surface.secondaryHover).toBe("#e5ecfd");
            expect(semanticLight.surface.secondaryPressed).toBe("#ccd9fc");
            expect(semanticLight.surface.error).toBe("#fce8ea");
            expect(semanticLight.surface.success).toBe("#f3fcf7");
            expect(semanticLight.surface.warning).toBe("#fef9f2");
        });

        it("should have correct border values", () => {
            expect(semanticLight.border.subtle).toBe("#f5f5f5");
            expect(semanticLight.border.focus).toBe("#a3a3a3");
            expect(semanticLight.border.error).toBe("#e31c31");
            expect(semanticLight.border.success).toBe("#09be67");
            expect(semanticLight.border.warning).toBe("#ec7e00");
            expect(semanticLight.border.default).toBe("#e2e2e2");
        });

        it("should have correct icon values", () => {
            expect(semanticLight.icon.primary).toBe("#000000");
            expect(semanticLight.icon.secondary).toBe("#525252");
            expect(semanticLight.icon.tertiary).toBe("#a3a3a3");
            expect(semanticLight.icon.disabled).toBe("#a3a3a3");
            expect(semanticLight.icon.action).toBe("#0043ef");
            expect(semanticLight.icon.actionHover).toBe("#0036bf");
            expect(semanticLight.icon.onAction).toBe("#ffffff");
            expect(semanticLight.icon.error).toBe("#e31c31");
            expect(semanticLight.icon.success).toBe("#09be67");
            expect(semanticLight.icon.warning).toBe("#ec7e00");
        });
    });

    describe("semanticDark (behavior-preserving guard)", () => {
        it("should have correct text values", () => {
            expect(semanticDark.text.primary).toBe("#ffffff");
            expect(semanticDark.text.secondary).toBe("#f7f7f7");
            expect(semanticDark.text.tertiary).toBe("#f5f5f5");
            expect(semanticDark.text.disabled).toBe("#a3a3a3");
            expect(semanticDark.text.action).toBe("#668ef5");
            expect(semanticDark.text.actionHover).toBe("#0036bf");
            expect(semanticDark.text.onAction).toBe("#ffffff");
            expect(semanticDark.text.error).toBe("#e9495a");
            expect(semanticDark.text.success).toBe("#09be67");
            expect(semanticDark.text.warning).toBe("#ec7e00");
        });

        it("should have correct surface values", () => {
            expect(semanticDark.surface.primary).toBe("#0043ef");
            expect(semanticDark.surface.secondary).toBe("#00288f");
            expect(semanticDark.surface.background).toBe("#000000");
            expect(semanticDark.surface.background2).toBe("#000000");
            expect(semanticDark.surface.elevated).toBe("#262626");
            expect(semanticDark.surface.muted).toBe("#525252");
            expect(semanticDark.surface.tertiary).toBe("#737373");
            expect(semanticDark.surface.overlay).toBe("#000000b2");
            expect(semanticDark.surface.disabled).toBe("#e2e2e2");
            expect(semanticDark.surface.primaryHover).toBe("#0036bf");
            expect(semanticDark.surface.primaryPressed).toBe("#00288f");
            expect(semanticDark.surface.secondaryHover).toBe("#e5ecfd");
            expect(semanticDark.surface.secondaryPressed).toBe("#ccd9fc");
            expect(semanticDark.surface.error).toBe("#b61627");
            expect(semanticDark.surface.success).toBe("#05723e");
            expect(semanticDark.surface.warning).toBe("#8e4c00");
        });

        it("should have correct border values", () => {
            expect(semanticDark.border.subtle).toBe("#737373");
            expect(semanticDark.border.focus).toBe("#a3a3a3");
            expect(semanticDark.border.error).toBe("#e31c31");
            expect(semanticDark.border.success).toBe("#09be67");
            expect(semanticDark.border.warning).toBe("#ec7e00");
            expect(semanticDark.border.default).toBe("#525252");
        });

        it("should have correct icon values", () => {
            expect(semanticDark.icon.primary).toBe("#ffffff");
            expect(semanticDark.icon.secondary).toBe("#f7f7f7");
            expect(semanticDark.icon.tertiary).toBe("#f7f7f7");
            expect(semanticDark.icon.disabled).toBe("#a3a3a3");
            expect(semanticDark.icon.action).toBe("#0043ef");
            expect(semanticDark.icon.actionHover).toBe("#0036bf");
            expect(semanticDark.icon.onAction).toBe("#ffffff");
            expect(semanticDark.icon.error).toBe("#e31c31");
            expect(semanticDark.icon.success).toBe("#09be67");
            expect(semanticDark.icon.warning).toBe("#ec7e00");
        });
    });
});
