import { describe, expect, it } from "vitest";
import { ProductInformationPanel } from "./ProductInformationPanel";

describe("ProductInformationPanel", () => {
    it("should be importable (Rolldown can parse the component)", () => {
        // This test verifies that Rolldown beta.50 can now parse the ProductInformationPanel component
        // which uses PanelAccordion, Button, and other complex UI components from @frak-labs/ui
        expect(ProductInformationPanel).toBeDefined();
        expect(typeof ProductInformationPanel).toBe("function");
    });

    it("should have the correct display name", () => {
        // Verify the component is the right one
        expect(ProductInformationPanel.name).toBe("ProductInformationPanel");
    });
});
