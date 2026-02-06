import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";

vi.mock("@frak-labs/core-sdk", () => ({
    generateSsoUrl: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        addLastAuthentication: vi.fn(),
        emitLifecycleEvent: vi.fn(),
        trackAuthCompleted: vi.fn(),
        sessionStore: {
            getState: vi.fn().mockReturnValue({
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
            }),
        },
    };
});

describe("ssoHandler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("processSsoCompletion", () => {
        test("should store session and sdkSession in stores", async () => {
            const { sessionStore, addLastAuthentication, trackAuthCompleted } =
                await import("@frak-labs/wallet-shared");

            const setSession = vi.fn();
            const setSdkSession = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                setSession,
                setSdkSession,
            } as any);
            vi.mocked(addLastAuthentication).mockResolvedValue(undefined);
            vi.mocked(trackAuthCompleted).mockResolvedValue(undefined);

            const mockSession = {
                address: "0x123" as `0x${string}`,
                token: "session-token",
            };
            const mockSdkSession = { token: "sdk-token" };

            const { processSsoCompletion } = await import("./ssoHandler");
            await processSsoCompletion(
                mockSession as any,
                mockSdkSession as any
            );

            expect(addLastAuthentication).toHaveBeenCalled();
            expect(setSession).toHaveBeenCalled();
            expect(setSdkSession).toHaveBeenCalledWith(mockSdkSession);
            expect(trackAuthCompleted).toHaveBeenCalledWith(
                "sso",
                expect.objectContaining({ address: "0x123" })
            );
        });

        test("should handle errors and reject pending request", async () => {
            const { addLastAuthentication } = await import(
                "@frak-labs/wallet-shared"
            );
            vi.mocked(addLastAuthentication).mockRejectedValue(
                new Error("Storage failed")
            );

            const mockSession = {
                address: "0x123" as `0x${string}`,
                token: "t",
            };

            const { processSsoCompletion } = await import("./ssoHandler");
            await expect(
                processSsoCompletion(mockSession as any, {} as any)
            ).rejects.toThrow("Storage failed");
        });
    });

    describe("handleSsoComplete", () => {
        test("should call processSsoCompletion and return success", async () => {
            const { sessionStore, addLastAuthentication, trackAuthCompleted } =
                await import("@frak-labs/wallet-shared");

            const setSession = vi.fn();
            const setSdkSession = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                setSession,
                setSdkSession,
            } as any);
            vi.mocked(addLastAuthentication).mockResolvedValue(undefined);
            vi.mocked(trackAuthCompleted).mockResolvedValue(undefined);

            const mockSession = {
                address: "0x456" as `0x${string}`,
                token: "tok",
            };
            const mockSdkSession = { token: "sdk" };

            const { handleSsoComplete } = await import("./ssoHandler");
            const result = await handleSsoComplete(
                [mockSession as any, mockSdkSession as any],
                {} as any
            );

            expect(result).toEqual({ success: true });
            expect(setSession).toHaveBeenCalled();
        });
    });

    describe("handlePrepareSso", () => {
        test("should generate SSO URL and return it", async () => {
            const { generateSsoUrl } = await import("@frak-labs/core-sdk");
            vi.mocked(generateSsoUrl).mockReturnValue(
                "https://wallet.frak.id/sso?test=1"
            );

            const context = {
                merchantId: "merchant-123",
                clientId: "client-456",
                origin: "https://example.com",
            };

            const ssoInfo = { redirectUrl: "https://example.com/callback" };
            const name = "Test App";
            const css = "https://cdn.example.com/style.css";

            const { handlePrepareSso } = await import("./ssoHandler");
            const result = await handlePrepareSso(
                [ssoInfo as any, name, css],
                context as any
            );

            expect(result).toEqual({
                ssoUrl: "https://wallet.frak.id/sso?test=1",
            });
            expect(generateSsoUrl).toHaveBeenCalledWith(
                window.location.origin,
                ssoInfo,
                "merchant-123",
                name,
                css,
                "client-456"
            );
        });
    });

    describe("handleOpenSso", () => {
        test("should emit redirect lifecycle event in redirect mode", async () => {
            const { generateSsoUrl } = await import("@frak-labs/core-sdk");
            const { emitLifecycleEvent } = await import(
                "@frak-labs/wallet-shared"
            );

            vi.mocked(generateSsoUrl).mockReturnValue(
                "https://wallet.frak.id/sso?redirect=1"
            );

            const ssoInfo = {
                openInSameWindow: true,
                redirectUrl: "https://example.com",
            };
            const context = {
                merchantId: "m-1",
                clientId: "c-1",
            };

            const { handleOpenSso } = await import("./ssoHandler");
            const result = await handleOpenSso(
                [ssoInfo as any, "name", "css"],
                context as any
            );

            expect(result).toEqual({ wallet: undefined });
            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "redirect",
                data: {
                    baseRedirectUrl: "https://wallet.frak.id/sso?redirect=1",
                },
            });
        });

        test("should infer redirect mode from redirectUrl presence", async () => {
            const { generateSsoUrl } = await import("@frak-labs/core-sdk");
            const { emitLifecycleEvent } = await import(
                "@frak-labs/wallet-shared"
            );

            vi.mocked(generateSsoUrl).mockReturnValue("https://sso-url");

            const ssoInfo = {
                redirectUrl: "https://example.com/done",
            };

            const { handleOpenSso } = await import("./ssoHandler");
            const result = await handleOpenSso([ssoInfo as any, "", ""], {
                merchantId: "m",
                clientId: "c",
            } as any);

            expect(result).toEqual({ wallet: undefined });
            expect(emitLifecycleEvent).toHaveBeenCalled();
        });
    });
});
