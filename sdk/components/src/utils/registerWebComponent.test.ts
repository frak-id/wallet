import * as onDocumentReady from "@frak-labs/ui/utils/onDocumentReady";
import register from "preact-custom-element";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as initFrakSdk from "./initFrakSdk";
import { registerWebComponent } from "./registerWebComponent";

// Mock dependencies
vi.mock("./initFrakSdk", () => ({
    initFrakSdk: vi.fn(),
}));

vi.mock("@frak-labs/ui/utils/onDocumentReady", () => ({
    onDocumentReady: vi.fn((callback) => {
        // Execute callback immediately in test environment
        callback();
    }),
}));

vi.mock("preact-custom-element", () => ({
    default: vi.fn(),
}));

describe("registerWebComponent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset customElements registry
        if (typeof customElements !== "undefined") {
            // Clear any registered elements
            vi.spyOn(customElements, "get").mockReturnValue(undefined);
        }
    });

    it("should initialize SDK when document is ready", () => {
        const TestComponent = () => null;

        registerWebComponent(TestComponent, "test-element");

        expect(onDocumentReady.onDocumentReady).toHaveBeenCalledWith(
            initFrakSdk.initFrakSdk
        );
    });

    it("should register component with custom element", () => {
        const TestComponent = () => null;
        vi.spyOn(customElements, "get").mockReturnValue(undefined);

        registerWebComponent(TestComponent, "test-element");

        expect(register).toHaveBeenCalledWith(
            TestComponent,
            "test-element",
            [],
            { shadow: false }
        );
    });

    it("should not register component if already registered", () => {
        const TestComponent = () => null;
        vi.spyOn(customElements, "get").mockReturnValue({} as any);

        registerWebComponent(TestComponent, "test-element");

        expect(register).not.toHaveBeenCalled();
    });

    it("should pass observedAttributes to register", () => {
        const TestComponent = () => null;
        const observedAttributes = ["text", "classname"];
        vi.spyOn(customElements, "get").mockReturnValue(undefined);

        registerWebComponent(TestComponent, "test-element", observedAttributes);

        expect(register).toHaveBeenCalledWith(
            TestComponent,
            "test-element",
            observedAttributes,
            { shadow: false }
        );
    });

    it("should pass shadow option to register", () => {
        const TestComponent = () => null;
        vi.spyOn(customElements, "get").mockReturnValue(undefined);

        registerWebComponent(TestComponent, "test-element", [], {
            shadow: true,
        });

        expect(register).toHaveBeenCalledWith(
            TestComponent,
            "test-element",
            [],
            { shadow: true }
        );
    });

    it("should not register in non-browser environment", () => {
        const originalWindow = global.window;
        // @ts-expect-error - Testing non-browser environment
        global.window = undefined;

        const TestComponent = () => null;

        registerWebComponent(TestComponent, "test-element");

        expect(register).not.toHaveBeenCalled();

        global.window = originalWindow;
    });
});
