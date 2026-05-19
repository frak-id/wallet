import { describe, expect, it } from "vitest";
import { MerchantInformationPanel } from "./MerchantInformationPanel";

describe("MerchantInformationPanel", () => {
    it("should be importable (Rolldown can parse the component)", () => {
        // Smoke test: ensure the component module parses and exports a component.
        expect(MerchantInformationPanel).toBeDefined();
        expect(typeof MerchantInformationPanel).toBe("function");
    });

    it("should have the correct display name", () => {
        // Verify the component is the right one
        expect(MerchantInformationPanel.name).toBe("MerchantInformationPanel");
    });
});
