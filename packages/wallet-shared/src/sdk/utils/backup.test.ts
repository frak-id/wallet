import type { Address, Hex } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingInteraction } from "../../types/Interaction";
import type { SdkSession, Session } from "../../types/Session";
import { pushBackupData, restoreBackupData } from "./backup";

// Mock external dependencies
vi.mock("@frak-labs/core-sdk", () => ({
    base64urlDecode: vi.fn((input: string) => input),
    base64urlEncode: vi.fn((input: unknown) => String(input)),
}));

vi.mock("@frak-labs/frame-connector", () => ({
    decompressDataAndCheckHash: vi.fn(<T>(input: unknown): T => input as T),
    hashAndCompressData: vi.fn((input: unknown) => input),
}));

vi.mock("../../stores/sessionStore", async () => {
    const actual = await vi.importActual<
        typeof import("../../stores/sessionStore")
    >("../../stores/sessionStore");
    return {
        ...actual,
        sessionStore: {
            getState: vi.fn(),
        },
    };
});

vi.mock("../../stores/walletStore", async () => {
    const actual = await vi.importActual<
        typeof import("../../stores/walletStore")
    >("../../stores/walletStore");
    return {
        ...actual,
        walletStore: {
            getState: vi.fn(),
        },
    };
});

vi.mock("./lifecycleEvents", () => ({
    emitLifecycleEvent: vi.fn(),
}));

describe("backup utilities", () => {
    const mockProductId = "0x1234" as Hex;
    const mockSession: Session = {
        type: "webauthn",
        address: "0x1234567890123456789012345678901234567890" as Address,
        publicKey: {
            x: "0xabc" as `0x${string}`,
            y: "0xdef" as `0x${string}`,
        },
        authenticatorId: "auth-123",
        token: "session-token",
    };
    const mockSdkSession: SdkSession = {
        token: "sdk-token",
        expires: Date.now() + 3600000,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock console methods to avoid cluttering test output
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("restoreBackupData", () => {
        it("should restore session data from valid backup", async () => {
            const { base64urlDecode } = await import("@frak-labs/core-sdk");
            const { decompressDataAndCheckHash } = await import(
                "@frak-labs/frame-connector"
            );
            const { sessionStore } = await import("../../stores/sessionStore");

            const mockSetSession = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: mockSetSession,
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });

            const mockBackupData = {
                productId: mockProductId,
                session: mockSession,
                expireAtTimestamp: Date.now() + 86400000,
            };

            vi.mocked(base64urlDecode).mockReturnValue(
                "decompressed-data" as never
            );
            vi.mocked(decompressDataAndCheckHash).mockReturnValue(
                mockBackupData as never
            );

            await restoreBackupData({
                backup: "backup-string",
                productId: mockProductId,
            });

            expect(base64urlDecode).toHaveBeenCalledWith("backup-string");
            expect(decompressDataAndCheckHash).toHaveBeenCalledWith(
                "decompressed-data"
            );
            expect(mockSetSession).toHaveBeenCalledWith(mockSession);
        });

        it("should restore SDK session from valid backup", async () => {
            const { base64urlDecode } = await import("@frak-labs/core-sdk");
            const { decompressDataAndCheckHash } = await import(
                "@frak-labs/frame-connector"
            );
            const { sessionStore } = await import("../../stores/sessionStore");

            const mockSetSdkSession = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: mockSetSdkSession,
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });

            const mockBackupData = {
                productId: mockProductId,
                sdkSession: mockSdkSession,
                expireAtTimestamp: Date.now() + 86400000,
            };

            vi.mocked(base64urlDecode).mockReturnValue(
                "decompressed-data" as never
            );
            vi.mocked(decompressDataAndCheckHash).mockReturnValue(
                mockBackupData as never
            );

            await restoreBackupData({
                backup: "backup-string",
                productId: mockProductId,
            });

            expect(mockSetSdkSession).toHaveBeenCalledWith(mockSdkSession);
        });

        it("should restore pending interactions from valid backup", async () => {
            const { base64urlDecode } = await import("@frak-labs/core-sdk");
            const { decompressDataAndCheckHash } = await import(
                "@frak-labs/frame-connector"
            );
            const { sessionStore } = await import("../../stores/sessionStore");
            const { walletStore } = await import("../../stores/walletStore");

            const mockAddPendingInteractions = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });
            vi.mocked(walletStore.getState).mockReturnValue({
                pendingInteractions: { interactions: [] },
                interactionSession: null,
                addPendingInteraction: vi.fn(),
                addPendingInteractions: mockAddPendingInteractions,
                cleanPendingInteractions: vi.fn(),
                setInteractionSession: vi.fn(),
                clearWallet: vi.fn(),
            });

            const mockPendingInteractions: PendingInteraction[] = [
                {
                    productId: mockProductId,
                    interaction: { type: "test" },
                } as unknown as PendingInteraction,
            ];

            const mockBackupData = {
                productId: mockProductId,
                pendingInteractions: mockPendingInteractions,
                expireAtTimestamp: Date.now() + 86400000,
            };

            vi.mocked(base64urlDecode).mockReturnValue(
                "decompressed-data" as never
            );
            vi.mocked(decompressDataAndCheckHash).mockReturnValue(
                mockBackupData as never
            );

            await restoreBackupData({
                backup: "backup-string",
                productId: mockProductId,
            });

            expect(mockAddPendingInteractions).toHaveBeenCalledWith(
                mockPendingInteractions
            );
        });

        it("should not restore data if productId does not match", async () => {
            const { base64urlDecode } = await import("@frak-labs/core-sdk");
            const { decompressDataAndCheckHash } = await import(
                "@frak-labs/frame-connector"
            );

            const mockBackupData = {
                productId: "0x5678" as Hex,
                session: mockSession,
                expireAtTimestamp: Date.now() + 86400000,
            };

            vi.mocked(base64urlDecode).mockReturnValue(
                "decompressed-data" as never
            );
            vi.mocked(decompressDataAndCheckHash).mockReturnValue(
                mockBackupData as never
            );

            await expect(
                restoreBackupData({
                    backup: "backup-string",
                    productId: mockProductId,
                })
            ).rejects.toThrow("Invalid backup data");
        });

        it("should emit remove-backup event if backup is expired", async () => {
            const { base64urlDecode } = await import("@frak-labs/core-sdk");
            const { decompressDataAndCheckHash } = await import(
                "@frak-labs/frame-connector"
            );
            const { emitLifecycleEvent } = await import("./lifecycleEvents");

            const mockBackupData = {
                productId: mockProductId,
                session: mockSession,
                expireAtTimestamp: Date.now() - 86400000, // Expired
            };

            vi.mocked(base64urlDecode).mockReturnValue(
                "decompressed-data" as never
            );
            vi.mocked(decompressDataAndCheckHash).mockReturnValue(
                mockBackupData as never
            );

            await restoreBackupData({
                backup: "backup-string",
                productId: mockProductId,
            });

            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "remove-backup",
            });
        });

        it("should handle decompression errors gracefully", async () => {
            const { base64urlDecode } = await import("@frak-labs/core-sdk");

            vi.mocked(base64urlDecode).mockImplementation(() => {
                throw new Error("Decompression failed");
            });

            await restoreBackupData({
                backup: "invalid-backup",
                productId: mockProductId,
            });

            expect(console.error).toHaveBeenCalledWith(
                "Error decompressing backup data",
                expect.objectContaining({
                    backup: "invalid-backup",
                })
            );
        });

        it("should handle invalid backup data", async () => {
            const { base64urlDecode } = await import("@frak-labs/core-sdk");
            const { decompressDataAndCheckHash } = await import(
                "@frak-labs/frame-connector"
            );

            vi.mocked(base64urlDecode).mockReturnValue(
                "decompressed-data" as never
            );
            vi.mocked(decompressDataAndCheckHash).mockReturnValue(
                undefined as never
            );

            await restoreBackupData({
                backup: "backup-string",
                productId: mockProductId,
            });

            expect(console.log).toHaveBeenCalledWith(
                "restoreBackupData - invalid backup data",
                { data: undefined }
            );
        });

        it("should not restore session without token", async () => {
            const { base64urlDecode } = await import("@frak-labs/core-sdk");
            const { decompressDataAndCheckHash } = await import(
                "@frak-labs/frame-connector"
            );
            const { sessionStore } = await import("../../stores/sessionStore");

            const mockSetSession = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: mockSetSession,
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });

            const sessionWithoutToken = {
                ...mockSession,
                token: undefined as unknown as string,
            };

            const mockBackupData = {
                productId: mockProductId,
                session: sessionWithoutToken,
                expireAtTimestamp: Date.now() + 86400000,
            };

            vi.mocked(base64urlDecode).mockReturnValue(
                "decompressed-data" as never
            );
            vi.mocked(decompressDataAndCheckHash).mockReturnValue(
                mockBackupData as never
            );

            await restoreBackupData({
                backup: "backup-string",
                productId: mockProductId,
            });

            expect(mockSetSession).not.toHaveBeenCalled();
        });
    });

    describe("pushBackupData", () => {
        it("should push backup data with session", async () => {
            const { hashAndCompressData } = await import(
                "@frak-labs/frame-connector"
            );
            const { base64urlEncode } = await import("@frak-labs/core-sdk");
            const { sessionStore } = await import("../../stores/sessionStore");
            const { walletStore } = await import("../../stores/walletStore");
            const { emitLifecycleEvent } = await import("./lifecycleEvents");

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: mockSession,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });
            vi.mocked(walletStore.getState).mockReturnValue({
                pendingInteractions: { interactions: [] },
                interactionSession: null,
                addPendingInteraction: vi.fn(),
                addPendingInteractions: vi.fn(),
                cleanPendingInteractions: vi.fn(),
                setInteractionSession: vi.fn(),
                clearWallet: vi.fn(),
            });

            vi.mocked(hashAndCompressData).mockReturnValue(
                "compressed-data" as never
            );
            vi.mocked(base64urlEncode).mockReturnValue("encoded-backup");

            await pushBackupData({ productId: mockProductId });

            expect(hashAndCompressData).toHaveBeenCalledWith(
                expect.objectContaining({
                    session: mockSession,
                    productId: mockProductId,
                })
            );
            expect(base64urlEncode).toHaveBeenCalledWith("compressed-data");
            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "do-backup",
                data: { backup: "encoded-backup" },
            });
        });

        it("should push backup data with SDK session", async () => {
            const { hashAndCompressData } = await import(
                "@frak-labs/frame-connector"
            );
            const { sessionStore } = await import("../../stores/sessionStore");
            const { walletStore } = await import("../../stores/walletStore");

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: mockSdkSession,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });
            vi.mocked(walletStore.getState).mockReturnValue({
                pendingInteractions: { interactions: [] },
                interactionSession: null,
                addPendingInteraction: vi.fn(),
                addPendingInteractions: vi.fn(),
                cleanPendingInteractions: vi.fn(),
                setInteractionSession: vi.fn(),
                clearWallet: vi.fn(),
            });

            vi.mocked(hashAndCompressData).mockReturnValue(
                "compressed-data" as never
            );

            await pushBackupData({ productId: mockProductId });

            expect(hashAndCompressData).toHaveBeenCalledWith(
                expect.objectContaining({
                    sdkSession: mockSdkSession,
                })
            );
        });

        it("should push backup data with pending interactions", async () => {
            const { hashAndCompressData } = await import(
                "@frak-labs/frame-connector"
            );
            const { sessionStore } = await import("../../stores/sessionStore");
            const { walletStore } = await import("../../stores/walletStore");

            const mockPendingInteractions: PendingInteraction[] = [
                {
                    productId: mockProductId,
                    interaction: { type: "test" },
                } as unknown as PendingInteraction,
            ];

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });
            vi.mocked(walletStore.getState).mockReturnValue({
                pendingInteractions: { interactions: mockPendingInteractions },
                interactionSession: null,
                addPendingInteraction: vi.fn(),
                addPendingInteractions: vi.fn(),
                cleanPendingInteractions: vi.fn(),
                setInteractionSession: vi.fn(),
                clearWallet: vi.fn(),
            });

            vi.mocked(hashAndCompressData).mockReturnValue(
                "compressed-data" as never
            );

            await pushBackupData({ productId: mockProductId });

            expect(hashAndCompressData).toHaveBeenCalledWith(
                expect.objectContaining({
                    pendingInteractions: mockPendingInteractions,
                })
            );
        });

        it("should emit remove-backup when no data to back up", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");
            const { walletStore } = await import("../../stores/walletStore");
            const { emitLifecycleEvent } = await import("./lifecycleEvents");

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });
            vi.mocked(walletStore.getState).mockReturnValue({
                pendingInteractions: { interactions: [] },
                interactionSession: null,
                addPendingInteraction: vi.fn(),
                addPendingInteractions: vi.fn(),
                cleanPendingInteractions: vi.fn(),
                setInteractionSession: vi.fn(),
                clearWallet: vi.fn(),
            });

            await pushBackupData({ productId: mockProductId });

            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "remove-backup",
            });
        });

        it("should not backup session without token", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");
            const { walletStore } = await import("../../stores/walletStore");
            const { emitLifecycleEvent } = await import("./lifecycleEvents");

            const sessionWithoutToken = {
                ...mockSession,
                token: undefined as unknown as string,
            };

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: sessionWithoutToken,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });
            vi.mocked(walletStore.getState).mockReturnValue({
                pendingInteractions: { interactions: [] },
                interactionSession: null,
                addPendingInteraction: vi.fn(),
                addPendingInteractions: vi.fn(),
                cleanPendingInteractions: vi.fn(),
                setInteractionSession: vi.fn(),
                clearWallet: vi.fn(),
            });

            await pushBackupData({ productId: mockProductId });

            // Should emit remove-backup since there's no valid data
            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "remove-backup",
            });
        });

        it("should not push backup when productId is not provided", async () => {
            const { emitLifecycleEvent } = await import("./lifecycleEvents");

            await pushBackupData();

            expect(console.log).toHaveBeenCalledWith(
                "No productId provided - skipping backup"
            );
            expect(emitLifecycleEvent).not.toHaveBeenCalled();
        });

        it("should include expiration timestamp in backup", async () => {
            const { hashAndCompressData } = await import(
                "@frak-labs/frame-connector"
            );
            const { sessionStore } = await import("../../stores/sessionStore");
            const { walletStore } = await import("../../stores/walletStore");

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: mockSession,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });
            vi.mocked(walletStore.getState).mockReturnValue({
                pendingInteractions: { interactions: [] },
                interactionSession: null,
                addPendingInteraction: vi.fn(),
                addPendingInteractions: vi.fn(),
                cleanPendingInteractions: vi.fn(),
                setInteractionSession: vi.fn(),
                clearWallet: vi.fn(),
            });

            vi.mocked(hashAndCompressData).mockReturnValue(
                "compressed-data" as never
            );

            const beforeCall = Date.now();
            await pushBackupData({ productId: mockProductId });
            const afterCall = Date.now();

            // Verify expireAtTimestamp is approximately one week from now
            const callArgs = vi.mocked(hashAndCompressData).mock.calls[0][0];
            const expireAt = (callArgs as { expireAtTimestamp: number })
                .expireAtTimestamp;
            const oneWeekMs = 7 * 24 * 60 * 60_000;

            expect(expireAt).toBeGreaterThanOrEqual(beforeCall + oneWeekMs);
            expect(expireAt).toBeLessThanOrEqual(afterCall + oneWeekMs);
        });
    });
});
