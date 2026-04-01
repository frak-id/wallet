import * as onDocumentReady from "@frak-labs/ui/utils/onDocumentReady";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as initFrakSdk from "./initFrakSdk";

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

    it("should initialize SDK when document is ready", async () => {
        await import("./loader");

        expect(onDocumentReady.onDocumentReady).toHaveBeenCalledWith(
            initFrakSdk.initFrakSdk
        );
    });

    it("should not inject loader stylesheet", async () => {
        await import("./loader");

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(document.getElementById("frak-components-styles")).toBeNull();
    });
});
