import type { Hex } from "viem";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { referralInteraction } from "./referralInteraction";

vi.mock("../../context", () => ({
    FrakContextManager: {
        parse: vi.fn(),
    },
}));

vi.mock("../index", () => ({
    watchWalletStatus: vi.fn(),
}));

vi.mock("./processReferral", () => ({
    processReferral: vi.fn(),
}));

describe("referralInteraction", () => {
    const mockClient = {
        request: vi.fn(),
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(global, "window", {
            value: { location: { href: "https://example.com?frak=test" } },
            writable: true,
        });
    });

    test("should forward the parsed context and wallet status to processReferral", async () => {
        const { FrakContextManager } = await import("../../context");
        const { watchWalletStatus } = await import("../index");
        const { processReferral } = await import("./processReferral");

        const mockContext = { r: "0xreferrer" as Hex };
        const mockWalletStatus = { wallet: "0x123" as Hex };
        const mockOptions = { alwaysAppendUrl: true };

        vi.mocked(FrakContextManager.parse).mockReturnValue(mockContext as any);
        vi.mocked(watchWalletStatus).mockResolvedValue(mockWalletStatus as any);
        vi.mocked(processReferral).mockResolvedValue("success");

        const result = await referralInteraction(mockClient, {
            options: mockOptions,
        });

        expect(FrakContextManager.parse).toHaveBeenCalledWith({
            url: "https://example.com?frak=test",
        });
        expect(processReferral).toHaveBeenCalledWith(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: mockContext,
            options: mockOptions,
        });
        expect(result).toBe("success");
    });

    test("should return undefined on error", async () => {
        const { FrakContextManager } = await import("../../context");
        const { watchWalletStatus } = await import("../index");
        const { processReferral } = await import("./processReferral");

        vi.mocked(FrakContextManager.parse).mockReturnValue({} as any);
        vi.mocked(watchWalletStatus).mockResolvedValue(null as any);
        vi.mocked(processReferral).mockImplementation(() => {
            throw new Error("Test error");
        });

        const consoleSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => {});

        const result = await referralInteraction(mockClient);

        expect(result).toBeUndefined();
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });
});
