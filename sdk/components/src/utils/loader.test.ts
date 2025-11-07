import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@frak-labs/ui/utils/onDocumentReady", () => ({
    onDocumentReady: vi.fn((callback) => {
        // Execute callback immediately in test environment
        callback();
    }),
}));

vi.mock("./initFrakSdk", () => ({
    initFrakSdk: vi.fn(),
}));

describe("loader", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset DOM
        document.head.innerHTML = "";
        document.body.innerHTML = "";
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should load CSS modules styles", async () => {
        // Import the loader module to trigger loadCssModules
        await import("./loader");

        // Wait a bit for async operations
        await new Promise((resolve) => setTimeout(resolve, 10));

        const linkElement = document.getElementById("frak-components-styles");
        expect(linkElement).toBeInTheDocument();
        expect(linkElement?.tagName).toBe("LINK");
        expect(linkElement?.getAttribute("rel")).toBe("stylesheet");
    });

    it("should not load CSS modules styles if already loaded", async () => {
        // Create existing link element
        const existingLink = document.createElement("link");
        existingLink.id = "frak-components-styles";
        document.head.appendChild(existingLink);

        // Import the loader module
        await import("./loader");

        // Wait a bit for async operations
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Should still only have one link element
        const links = document.querySelectorAll("#frak-components-styles");
        expect(links).toHaveLength(1);
    });
});
