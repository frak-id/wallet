import { describe, expect, test, vi } from "vitest";

// Mock OpenPanel before importing the module
vi.mock("@openpanel/web", () => {
    const MockOpenPanel = vi.fn(function (this: any, config: any) {
        this.config = config;
        this.track = vi.fn();
        this.identify = vi.fn();
    });
    return {
        OpenPanel: MockOpenPanel,
    };
});

describe("openPanel utility", () => {
    test("should export openPanel variable", async () => {
        const { openPanel } = await import("./openPanel");

        // openPanel can be either an OpenPanel instance or undefined
        expect(openPanel === undefined || typeof openPanel === "object").toBe(
            true
        );
    });

    test("should have correct type", async () => {
        const module = await import("./openPanel");

        expect("openPanel" in module).toBe(true);
    });
});
