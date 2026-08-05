import { describe, expect, it } from "vitest";
import { hostSheet, hostSheetTopRadius, hostSheetVar } from "./hostSheet";

/**
 * The other half of this contract is `SharingHostStyle` in `sdk/android`, which
 * writes these exact property names into a `<style>` element at document start.
 * Nothing at build time links the two — the SDK is a separate Gradle project
 * that never sees this file — so the names are asserted literally on both
 * sides. `SharingHostStyleTest` is the mirror of this file.
 *
 * A rename that lands on one side only does not fail a build. It renders the
 * sheet square on an opaque rectangle, on a device, silently. These assertions
 * are the only thing that turns that into a red test.
 */
describe("host sheet custom properties", () => {
    it("keeps the exact names sdk/android writes", () => {
        expect(hostSheetVar.topRadius).toBe("--frak-host-top-radius");
        expect(hostSheetVar.surface).toBe("--frak-host-surface");
    });

    it("always resolves to the web appearance when a host sets nothing", () => {
        // Unset is the common case — every browser visit. A consumer that
        // forgot its fallback would resolve to the initial value (`0` for a
        // radius, `transparent` for a background), which for the surface means
        // an invisible page rather than a plain one.
        expect(hostSheet(hostSheetVar.surface, "#fff")).toBe(
            "var(--frak-host-surface, #fff)"
        );
        expect(hostSheetTopRadius).toContain(", 0px)");
    });

    it("rounds only the top two corners", () => {
        // A host sheet is anchored to the bottom of the screen; rounding all
        // four would cut the sheet away from the edge it is attached to.
        expect(hostSheetTopRadius).toBe(
            "var(--frak-host-top-radius, 0px) var(--frak-host-top-radius, 0px) 0 0"
        );
    });
});
