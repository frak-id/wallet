import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { describe, expect, it } from "vitest";
import { DEFAULT_TIER, TRANSPARENT } from "../style/styleCodec";
import type { ComponentSettingsFormValues } from "../types";
import {
    componentsToFormValues,
    formValuesToComponents,
} from "./fieldDefaults";

const PLACEMENT_TIER = "product";

type Components = SdkConfig["components"];

function formValues(
    components: Components,
    override: Partial<ComponentSettingsFormValues["buttonShare"]> = {}
): ComponentSettingsFormValues {
    const loaded = componentsToFormValues(components);
    return {
        targetInteraction: "",
        ...loaded,
        buttonShare: { ...loaded.buttonShare, ...override },
    };
}

describe("componentsToFormValues", () => {
    it("loads an unset component with empty controls and no foreign CSS", () => {
        const { buttonShare } = componentsToFormValues(undefined);
        expect(buttonShare.style).toEqual({});
        expect(buttonShare.foreignCss).toBe("");
    });

    it("loads a placement holding only clickAction without error", () => {
        const { buttonShare } = componentsToFormValues({
            buttonShare: { clickAction: "sharing-page" },
        } as Components);
        expect(buttonShare.style).toEqual({});
        expect(buttonShare.foreignCss).toBe("");
    });

    it("loads legacy hand-written CSS as foreign with empty controls", () => {
        const legacy = ".button{color:red}";
        const { buttonShare } = componentsToFormValues({
            buttonShare: { rawCss: legacy },
        } as Components);
        expect(buttonShare.style).toEqual({});
        expect(buttonShare.foreignCss).toBe(legacy);
    });

    it("reads stored control values back into the form", () => {
        const stored = formValuesToComponents(
            formValues(undefined, { style: { fs: 12, bg: TRANSPARENT } }),
            PLACEMENT_TIER
        );
        const { buttonShare } = componentsToFormValues(stored as Components);
        expect(buttonShare.style).toEqual({ fs: 12, bg: TRANSPARENT });
    });
});

describe("formValuesToComponents", () => {
    it("sends rawCss undefined when nothing is set", () => {
        const body = formValuesToComponents(
            formValues(undefined),
            PLACEMENT_TIER
        );
        expect(body.buttonShare.rawCss).toBeUndefined();
    });

    it("writes the nested shape at a placement tier", () => {
        const body = formValuesToComponents(
            formValues(undefined, { style: { fs: 12 } }),
            PLACEMENT_TIER
        );
        expect(body.buttonShare.rawCss).toContain("\n.button{");
        expect(body.buttonShare.rawCss).not.toContain("frak-button-share");
    });

    it("writes the self-scoped shape at the default tier", () => {
        const body = formValuesToComponents(
            formValues(undefined, { style: { fs: 12 } }),
            DEFAULT_TIER
        );
        expect(body.buttonShare.rawCss).toContain("frak-button-share .button{");
    });

    it("leaves the wording fields untouched when only style changes", () => {
        const components = {
            buttonShare: { text: "Share me", clickAction: "sharing-page" },
        } as Components;
        const body = formValuesToComponents(
            formValues(components, { style: { fs: 12 } }),
            PLACEMENT_TIER
        );
        expect(body.buttonShare.text).toBe("Share me");
        expect(body.buttonShare.clickAction).toBe("sharing-page");
    });

    it("keeps legacy CSS in the saved body alongside new control values", () => {
        const legacy = ".button:hover{opacity:.8}";
        const body = formValuesToComponents(
            formValues({ buttonShare: { rawCss: legacy } } as Components, {
                style: { fs: 12 },
            }),
            PLACEMENT_TIER
        );
        const rawCss = body.buttonShare.rawCss ?? "";
        expect(rawCss).toContain(legacy);
        expect(rawCss.indexOf(legacy)).toBeLessThan(rawCss.indexOf(".button{"));
    });

    it("keeps legacy CSS when every control is cleared", () => {
        const legacy = ".button:hover{opacity:.8}";
        const body = formValuesToComponents(
            formValues({ buttonShare: { rawCss: legacy } } as Components),
            PLACEMENT_TIER
        );
        expect(body.buttonShare.rawCss).toBe(legacy);
    });

    it("does not touch the other components", () => {
        const body = formValuesToComponents(
            formValues(undefined, { style: { fs: 12 } }),
            PLACEMENT_TIER
        );
        expect(body.banner.rawCss).toBeUndefined();
        expect(body.postPurchase.rawCss).toBeUndefined();
    });

    it("round-trips control values through a save and a reload", () => {
        const style = {
            bg: TRANSPARENT,
            fg: "#000000",
            bw: 1,
            bc: "#000000",
            fs: 12,
            py: 10,
            px: 24,
            ml: 12,
            mr: 16,
        };
        const saved = formValuesToComponents(
            formValues(undefined, { style }),
            PLACEMENT_TIER
        );
        const reloaded = componentsToFormValues(saved as Components);
        expect(reloaded.buttonShare.style).toEqual(style);
    });
});
