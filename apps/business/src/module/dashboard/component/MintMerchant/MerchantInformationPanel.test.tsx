import { describe, expect, it } from "vitest";
import { MerchantInformationPanel } from "./MerchantInformationPanel";

describe("MerchantInformationPanel", () => {
    it("should be importable (Rolldown can parse the component)", () => {
        // This test verifies that Rolldown beta.50 can now parse the MerchantInformationPanel component
        // which uses PanelAccordion, Button, and other complex UI components from @frak-labs/ui
        expect(MerchantInformationPanel).toBeDefined();
        expect(typeof MerchantInformationPanel).toBe("function");
    });

    it("should have the correct display name", () => {
        // Verify the component is the right one
        expect(MerchantInformationPanel.name).toBe("MerchantInformationPanel");
    });
});
