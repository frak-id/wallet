import type { Address, Hex } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SdkSession, Session } from "../../types/Session";
import { pushBackupData, restoreBackupData } from "./backup";

// Mock external dependencies
vi.mock("@frak-labs/core-sdk", () => ({
    base64urlDecode: vi.fn((input: string) => {
        // Decode base64url string to Uint8Array
        const binaryString = atob(input.replace(/-/g, "+").replace(/_/g, "/"));
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }),
    base64urlEncode: vi.fn((input: Uint8Array) => {
        // Encode Uint8Array to base64url string
        const binaryString = String.fromCharCode(...input);
        return btoa(binaryString)
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=/g, "");
    }),
}));

vi.mock("viem", () => ({
    sha256: vi.fn((input: Uint8Array) => {
        // Simple mock hash - just return a deterministic hex string
        return `0x${Array.from(input)
            .reduce((acc, byte) => acc + byte, 0)
            .toString(16)
            .padStart(64, "0")}`;
    }),
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
            const { base64urlEncode } = await import("@frak-labs/core-sdk");
            const { sha256 } = await import("viem");
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

            // Create hash-protected backup
            const jsonData = JSON.stringify(mockBackupData);
            const hash = vi.mocked(sha256)(new TextEncoder().encode(jsonData));
            const hashProtected = {
                ...mockBackupData,
                validationHash: hash,
            };

            // Encode as JSON + base64url
            const encoded = vi.mocked(base64urlEncode)(
                new TextEncoder().encode(JSON.stringify(hashProtected))
            );

            await restoreBackupData({
                backup: encoded,
                productId: mockProductId,
            });

            expect(mockSetSession).toHaveBeenCalledWith(mockSession);
        });

        it("should restore SDK session from valid backup", async () => {
            const { base64urlEncode } = await import("@frak-labs/core-sdk");
            const { sha256 } = await import("viem");
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

            const jsonData = JSON.stringify(mockBackupData);
            const hash = vi.mocked(sha256)(new TextEncoder().encode(jsonData));
            const hashProtected = {
                ...mockBackupData,
                validationHash: hash,
            };

            const encoded = vi.mocked(base64urlEncode)(
                new TextEncoder().encode(JSON.stringify(hashProtected))
            );

            await restoreBackupData({
                backup: encoded,
                productId: mockProductId,
            });

            expect(mockSetSdkSession).toHaveBeenCalledWith(mockSdkSession);
        });

        it("should not restore data if productId does not match", async () => {
            const { base64urlEncode } = await import("@frak-labs/core-sdk");
            const { sha256 } = await import("viem");
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
                productId: "0x5678" as Hex,
                session: mockSession,
                expireAtTimestamp: Date.now() + 86400000,
            };

            const jsonData = JSON.stringify(mockBackupData);
            const hash = vi.mocked(sha256)(new TextEncoder().encode(jsonData));
            const hashProtected = {
                ...mockBackupData,
                validationHash: hash,
            };

            const encoded = vi.mocked(base64urlEncode)(
                new TextEncoder().encode(JSON.stringify(hashProtected))
            );

            await expect(
                restoreBackupData({
                    backup: encoded,
                    productId: mockProductId,
                })
            ).rejects.toThrow("Invalid backup data");

            expect(mockSetSession).not.toHaveBeenCalled();
        });

        it("should emit remove-backup event if backup is expired", async () => {
            const { base64urlEncode } = await import("@frak-labs/core-sdk");
            const { sha256 } = await import("viem");
            const { emitLifecycleEvent } = await import("./lifecycleEvents");
            const { sessionStore } = await import("../../stores/sessionStore");

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });

            const mockBackupData = {
                productId: mockProductId,
                session: mockSession,
                expireAtTimestamp: Date.now() - 86400000,
            };

            const jsonData = JSON.stringify(mockBackupData);
            const hash = vi.mocked(sha256)(new TextEncoder().encode(jsonData));
            const hashProtected = {
                ...mockBackupData,
                validationHash: hash,
            };

            const encoded = vi.mocked(base64urlEncode)(
                new TextEncoder().encode(JSON.stringify(hashProtected))
            );

            await restoreBackupData({
                backup: encoded,
                productId: mockProductId,
            });

            expect(vi.mocked(emitLifecycleEvent)).toHaveBeenCalledWith({
                iframeLifecycle: "remove-backup",
            });
        });

        it("should handle decompression errors gracefully", async () => {
            await restoreBackupData({
                backup: "invalid-backup",
                productId: mockProductId,
            });

            expect(console.error).toHaveBeenCalledWith(
                "[Backup] Failed to restore:",
                expect.any(Error)
            );
        });

        it("should handle invalid backup hash", async () => {
            const { base64urlEncode } = await import("@frak-labs/core-sdk");

            const mockBackupData = {
                productId: mockProductId,
                session: mockSession,
                expireAtTimestamp: Date.now() + 86400000,
            };

            const hashProtected = {
                ...mockBackupData,
                validationHash: "0xinvalidhash",
            };

            const encoded = vi.mocked(base64urlEncode)(
                new TextEncoder().encode(JSON.stringify(hashProtected))
            );

            await restoreBackupData({
                backup: encoded,
                productId: mockProductId,
            });

            expect(console.error).toHaveBeenCalledWith(
                "[Backup] Failed to restore:",
                expect.any(Error)
            );
        });

        it("should not restore session without token", async () => {
            const { base64urlEncode } = await import("@frak-labs/core-sdk");
            const { sha256 } = await import("viem");
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

            const jsonData = JSON.stringify(mockBackupData);
            const hash = vi.mocked(sha256)(new TextEncoder().encode(jsonData));
            const hashProtected = {
                ...mockBackupData,
                validationHash: hash,
            };

            const encoded = vi.mocked(base64urlEncode)(
                new TextEncoder().encode(JSON.stringify(hashProtected))
            );

            await restoreBackupData({
                backup: encoded,
                productId: mockProductId,
            });

            expect(mockSetSession).not.toHaveBeenCalled();
        });
    });

    describe("pushBackupData", () => {
        it("should push backup data with session", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");
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

            await pushBackupData({ productId: mockProductId });

            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "do-backup",
                data: { backup: expect.any(String) },
            });
        });

        it("should push backup data with SDK session", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");
            const { emitLifecycleEvent } = await import("./lifecycleEvents");

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: null,
                sdkSession: mockSdkSession,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            });

            await pushBackupData({ productId: mockProductId });

            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "do-backup",
                data: { backup: expect.any(String) },
            });
        });

        it("should emit remove-backup when no data to back up", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");
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

            await pushBackupData({ productId: mockProductId });

            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "remove-backup",
            });
        });

        it("should not backup session without token", async () => {
            const { sessionStore } = await import("../../stores/sessionStore");
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

            await pushBackupData({ productId: mockProductId });

            expect(vi.mocked(emitLifecycleEvent)).toHaveBeenCalledWith({
                iframeLifecycle: "remove-backup",
            });
        });

        it("should not push backup when productId is not provided", async () => {
            const { emitLifecycleEvent } = await import("./lifecycleEvents");

            await pushBackupData();

            expect(console.log).toHaveBeenCalledWith(
                "[Backup] No productId provided - skipping backup"
            );
            expect(emitLifecycleEvent).not.toHaveBeenCalled();
        });

        it("should include expiration timestamp and hash in backup", async () => {
            const { base64urlDecode } = await import("@frak-labs/core-sdk");
            const { sessionStore } = await import("../../stores/sessionStore");
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

            const beforeCall = Date.now();
            await pushBackupData({ productId: mockProductId });
            const afterCall = Date.now();

            const emitCall = vi.mocked(emitLifecycleEvent).mock.calls[0][0];
            const backupString = (
                emitCall as {
                    iframeLifecycle: string;
                    data: { backup: string };
                }
            ).data.backup;

            const decoded = JSON.parse(
                new TextDecoder().decode(
                    vi.mocked(base64urlDecode)(backupString)
                )
            );

            expect(decoded).toHaveProperty("validationHash");
            expect(decoded.validationHash).toMatch(/^0x[0-9a-f]+$/);

            const oneWeekMs = 7 * 24 * 60 * 60_000;
            expect(decoded.expireAtTimestamp).toBeGreaterThanOrEqual(
                beforeCall + oneWeekMs
            );
            expect(decoded.expireAtTimestamp).toBeLessThanOrEqual(
                afterCall + oneWeekMs
            );
        });
    });
});
