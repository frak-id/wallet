import type { Hex } from "viem";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { referralInteraction } from "./referralInteraction";

vi.mock("../../utils", () => ({
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

    const mockProductId =
        "0x0000000000000000000000000000000000000000000000000000000000000002" as Hex;

    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(global, "window", {
            value: { location: { href: "https://example.com?frak=test" } },
            writable: true,
        });
    });

    test("should parse context from window location", async () => {
        const { FrakContextManager } = await import("../../utils");
        const { watchWalletStatus } = await import("../index");
        const { processReferral } = await import("./processReferral");

        vi.mocked(FrakContextManager.parse).mockReturnValue({} as any);
        vi.mocked(watchWalletStatus).mockResolvedValue(null as any);
        vi.mocked(processReferral).mockResolvedValue("success");

        await referralInteraction(mockClient);

        expect(FrakContextManager.parse).toHaveBeenCalledWith({
            url: "https://example.com?frak=test",
        });
    });

    test("should get current wallet status", async () => {
        const { FrakContextManager } = await import("../../utils");
        const { watchWalletStatus } = await import("../index");
        const { processReferral } = await import("./processReferral");

        vi.mocked(FrakContextManager.parse).mockReturnValue({} as any);
        vi.mocked(watchWalletStatus).mockResolvedValue({
            wallet: "0x123" as Hex,
            interactionSession: true,
        } as any);
        vi.mocked(processReferral).mockResolvedValue("success");

        await referralInteraction(mockClient);

        expect(watchWalletStatus).toHaveBeenCalledWith(mockClient);
    });

    test("should call processReferral with all parameters", async () => {
        const { FrakContextManager } = await import("../../utils");
        const { watchWalletStatus } = await import("../index");
        const { processReferral } = await import("./processReferral");

        const mockContext = { r: "0xreferrer" as Hex };
        const mockWalletStatus = { wallet: "0x123" as Hex };
        const mockModalConfig = { type: "login" };
        const mockOptions = { alwaysAppendUrl: true };

        vi.mocked(FrakContextManager.parse).mockReturnValue(mockContext as any);
        vi.mocked(watchWalletStatus).mockResolvedValue(mockWalletStatus as any);
        vi.mocked(processReferral).mockResolvedValue("success");

        await referralInteraction(mockClient, {
            productId: mockProductId,
            modalConfig: mockModalConfig as any,
            options: mockOptions,
        });

        expect(processReferral).toHaveBeenCalledWith(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: mockContext,
            modalConfig: mockModalConfig,
            productId: mockProductId,
            options: mockOptions,
        });
    });

    test("should return result from processReferral", async () => {
        const { FrakContextManager } = await import("../../utils");
        const { watchWalletStatus } = await import("../index");
        const { processReferral } = await import("./processReferral");

        vi.mocked(FrakContextManager.parse).mockReturnValue({} as any);
        vi.mocked(watchWalletStatus).mockResolvedValue(null as any);
        vi.mocked(processReferral).mockResolvedValue("success");

        const result = await referralInteraction(mockClient);

        expect(result).toBe("success");
    });

    test("should return undefined on error", async () => {
        const { FrakContextManager } = await import("../../utils");
        const { watchWalletStatus } = await import("../index");
        const { processReferral } = await import("./processReferral");

        vi.mocked(FrakContextManager.parse).mockReturnValue({} as any);
        vi.mocked(watchWalletStatus).mockResolvedValue(null as any);
        vi.mocked(processReferral).mockRejectedValue(new Error("Test error"));

        const consoleSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => {});

        const result = await referralInteraction(mockClient);

        expect(result).toBeUndefined();
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    test("should work with empty options", async () => {
        const { FrakContextManager } = await import("../../utils");
        const { watchWalletStatus } = await import("../index");
        const { processReferral } = await import("./processReferral");

        vi.mocked(FrakContextManager.parse).mockReturnValue({} as any);
        vi.mocked(watchWalletStatus).mockResolvedValue(null as any);
        vi.mocked(processReferral).mockResolvedValue("no-referrer");

        const result = await referralInteraction(mockClient, {});

        expect(result).toBe("no-referrer");
        expect(processReferral).toHaveBeenCalledWith(
            mockClient,
            expect.objectContaining({
                modalConfig: undefined,
                productId: undefined,
                options: undefined,
            })
        );
    });
});
