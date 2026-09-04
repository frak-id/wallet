import { describe, expect, it } from "vitest";
import { hostSheet, hostSheetTopRadius, hostSheetVar } from "./hostSheet";

// Nothing at build time links these names to `SharingHostStyle` in `sdk/android`,
// which writes them; they are asserted literally on both sides.
describe("host sheet custom properties", () => {
    it("keeps the exact names sdk/android writes", () => {
        expect(hostSheetVar.topRadius).toBe("--frak-host-top-radius");
        expect(hostSheetVar.surface).toBe("--frak-host-surface");
    });

    it("always resolves to the web appearance when a host sets nothing", () => {
        expect(hostSheet(hostSheetVar.surface, "#fff")).toBe(
            "var(--frak-host-surface, #fff)"
        );
        expect(hostSheetTopRadius).toContain(", 0px)");
    });

    it("rounds only the top two corners", () => {
        expect(hostSheetTopRadius).toBe(
            "var(--frak-host-top-radius, 0px) var(--frak-host-top-radius, 0px) 0 0"
        );
    });
});
