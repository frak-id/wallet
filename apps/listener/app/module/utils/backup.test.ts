import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@frak-labs/core-sdk", () => ({
    base64urlDecode: vi.fn(),
    base64urlEncode: vi.fn(),
}));

vi.mock("viem", () => ({
    sha256: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared", () => ({
    emitLifecycleEvent: vi.fn(),
    sessionStore: {
        getState: vi.fn(),
    },
}));

describe("backup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("restoreBackupData", () => {
        test("should restore session and sdkSession from valid backup", async () => {
            const mockSession = {
                address: "0x123",
                token: "session-token",
            };
            const mockSdkSession = { token: "sdk-token" };
            const backupData = {
                domain: "example.com",
                session: mockSession,
                sdkSession: mockSdkSession,
                expireAtTimestamp: Date.now() + 1000 * 60 * 60,
            };
            const validationHash = "0xvalidhash";
            const hashProtected = { ...backupData, validationHash };

            const encoded = new TextEncoder().encode(
                JSON.stringify(hashProtected)
            );

            const { base64urlDecode } = await import("@frak-labs/core-sdk");
            const { sha256 } = await import("viem");
            const { sessionStore } = await import("@frak-labs/wallet-shared");

            vi.mocked(base64urlDecode).mockReturnValue(encoded);
            vi.mocked(sha256).mockReturnValue(validationHash);

            const setSession = vi.fn();
            const setSdkSession = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                setSession,
                setSdkSession,
            } as any);

            const { restoreBackupData } = await import("./backup");
            await restoreBackupData({
                backup: "encoded-backup",
                domain: "example.com",
            });

            expect(setSession).toHaveBeenCalledWith(mockSession);
            expect(setSdkSession).toHaveBeenCalledWith(mockSdkSession);
        });

        test("should restore only session when no sdkSession", async () => {
            const mockSession = {
                address: "0x123",
                token: "session-token",
            };
            const backupData = {
                domain: "example.com",
                session: mockSession,
                expireAtTimestamp: Date.now() + 1000 * 60 * 60,
            };
            const validationHash = "0xvalidhash";
            const hashProtected = { ...backupData, validationHash };

            const encoded = new TextEncoder().encode(
                JSON.stringify(hashProtected)
            );

            const { base64urlDecode } = await import("@frak-labs/core-sdk");
            const { sha256 } = await import("viem");
            const { sessionStore } = await import("@frak-labs/wallet-shared");

            vi.mocked(base64urlDecode).mockReturnValue(encoded);
            vi.mocked(sha256).mockReturnValue(validationHash);

            const setSession = vi.fn();
            const setSdkSession = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                setSession,
                setSdkSession,
            } as any);

            const { restoreBackupData } = await import("./backup");
            await restoreBackupData({
                backup: "encoded-backup",
                domain: "example.com",
            });

            expect(setSession).toHaveBeenCalledWith(mockSession);
            expect(setSdkSession).not.toHaveBeenCalled();
        });

        test("should not restore session without token", async () => {
            const mockSession = {
                address: "0x123",
                token: "",
            };
            const backupData = {
                domain: "example.com",
                session: mockSession,
                expireAtTimestamp: Date.now() + 1000 * 60 * 60,
            };
            const validationHash = "0xvalidhash";
            const hashProtected = { ...backupData, validationHash };

            const encoded = new TextEncoder().encode(
                JSON.stringify(hashProtected)
            );

            const { base64urlDecode } = await import("@frak-labs/core-sdk");
            const { sha256 } = await import("viem");
            const { sessionStore } = await import("@frak-labs/wallet-shared");

            vi.mocked(base64urlDecode).mockReturnValue(encoded);
            vi.mocked(sha256).mockReturnValue(validationHash);

            const setSession = vi.fn();
            const setSdkSession = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                setSession,
                setSdkSession,
            } as any);

            const { restoreBackupData } = await import("./backup");
            await restoreBackupData({
                backup: "encoded-backup",
                domain: "example.com",
            });

            expect(setSession).not.toHaveBeenCalled();
            expect(setSdkSession).not.toHaveBeenCalled();
        });

        test("should throw on domain mismatch", async () => {
            const backupData = {
                domain: "other.com",
                session: { address: "0x123", token: "tok" },
                expireAtTimestamp: Date.now() + 1000 * 60 * 60,
            };
            const validationHash = "0xvalidhash";
            const hashProtected = { ...backupData, validationHash };

            const encoded = new TextEncoder().encode(
                JSON.stringify(hashProtected)
            );

            const { base64urlDecode } = await import("@frak-labs/core-sdk");
            const { sha256 } = await import("viem");

            vi.mocked(base64urlDecode).mockReturnValue(encoded);
            vi.mocked(sha256).mockReturnValue(validationHash);

            const { restoreBackupData } = await import("./backup");
            await expect(
                restoreBackupData({
                    backup: "encoded-backup",
                    domain: "example.com",
                })
            ).rejects.toThrow("Invalid backup data");
        });

        test("should emit remove-backup when backup expired", async () => {
            const backupData = {
                domain: "example.com",
                session: { address: "0x123", token: "tok" },
                expireAtTimestamp: Date.now() - 1000,
            };
            const validationHash = "0xvalidhash";
            const hashProtected = { ...backupData, validationHash };

            const encoded = new TextEncoder().encode(
                JSON.stringify(hashProtected)
            );

            const { base64urlDecode } = await import("@frak-labs/core-sdk");
            const { sha256 } = await import("viem");
            const { emitLifecycleEvent, sessionStore } = await import(
                "@frak-labs/wallet-shared"
            );

            vi.mocked(base64urlDecode).mockReturnValue(encoded);
            vi.mocked(sha256).mockReturnValue(validationHash);

            const setSession = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                setSession,
            } as any);

            const { restoreBackupData } = await import("./backup");
            await restoreBackupData({
                backup: "encoded-backup",
                domain: "example.com",
            });

            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "remove-backup",
            });
            expect(setSession).not.toHaveBeenCalled();
        });

        test("should return early on invalid hash", async () => {
            const backupData = {
                domain: "example.com",
                session: { address: "0x123", token: "tok" },
                expireAtTimestamp: Date.now() + 1000 * 60 * 60,
            };
            const hashProtected = {
                ...backupData,
                validationHash: "0xcorrect",
            };

            const encoded = new TextEncoder().encode(
                JSON.stringify(hashProtected)
            );

            const { base64urlDecode } = await import("@frak-labs/core-sdk");
            const { sha256 } = await import("viem");
            const { sessionStore } = await import("@frak-labs/wallet-shared");

            vi.mocked(base64urlDecode).mockReturnValue(encoded);
            vi.mocked(sha256).mockReturnValue("0xwrong");

            const setSession = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                setSession,
            } as any);

            const { restoreBackupData } = await import("./backup");
            await restoreBackupData({
                backup: "encoded-backup",
                domain: "example.com",
            });

            expect(setSession).not.toHaveBeenCalled();
        });

        test("should return early on malformed base64", async () => {
            const { base64urlDecode } = await import("@frak-labs/core-sdk");
            const { sessionStore } = await import("@frak-labs/wallet-shared");

            vi.mocked(base64urlDecode).mockImplementation(() => {
                throw new Error("Invalid base64");
            });

            const setSession = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                setSession,
            } as any);

            const { restoreBackupData } = await import("./backup");
            await restoreBackupData({
                backup: "garbage",
                domain: "example.com",
            });

            expect(setSession).not.toHaveBeenCalled();
        });
    });

    describe("pushBackupData", () => {
        test("should return early when no domain provided", async () => {
            const { emitLifecycleEvent } = await import(
                "@frak-labs/wallet-shared"
            );

            const { pushBackupData } = await import("./backup");
            await pushBackupData();

            expect(emitLifecycleEvent).not.toHaveBeenCalled();
        });

        test("should return early when domain is undefined", async () => {
            const { emitLifecycleEvent } = await import(
                "@frak-labs/wallet-shared"
            );

            const { pushBackupData } = await import("./backup");
            await pushBackupData({ domain: undefined });

            expect(emitLifecycleEvent).not.toHaveBeenCalled();
        });

        test("should emit remove-backup when no session tokens exist", async () => {
            const { emitLifecycleEvent, sessionStore } = await import(
                "@frak-labs/wallet-shared"
            );

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: { address: "0x123", token: "" },
                sdkSession: { token: "" },
            } as any);

            const { pushBackupData } = await import("./backup");
            await pushBackupData({ domain: "example.com" });

            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "remove-backup",
            });
        });

        test("should emit remove-backup when no sessions at all", async () => {
            const { emitLifecycleEvent, sessionStore } = await import(
                "@frak-labs/wallet-shared"
            );

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: undefined,
                sdkSession: undefined,
            } as any);

            const { pushBackupData } = await import("./backup");
            await pushBackupData({ domain: "example.com" });

            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "remove-backup",
            });
        });

        test("should encode and emit do-backup when session has token", async () => {
            const { emitLifecycleEvent, sessionStore } = await import(
                "@frak-labs/wallet-shared"
            );
            const { base64urlEncode } = await import("@frak-labs/core-sdk");
            const { sha256 } = await import("viem");

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: { address: "0x123", token: "valid-token" },
                sdkSession: undefined,
            } as any);

            vi.mocked(sha256).mockReturnValue("0xhash");
            vi.mocked(base64urlEncode).mockReturnValue("encoded-backup");

            const { pushBackupData } = await import("./backup");
            await pushBackupData({ domain: "example.com" });

            expect(base64urlEncode).toHaveBeenCalled();
            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "do-backup",
                data: { backup: "encoded-backup" },
            });
        });

        test("should include both session and sdkSession when both have tokens", async () => {
            const { emitLifecycleEvent, sessionStore } = await import(
                "@frak-labs/wallet-shared"
            );
            const { base64urlEncode } = await import("@frak-labs/core-sdk");
            const { sha256 } = await import("viem");

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: { address: "0x123", token: "valid-token" },
                sdkSession: { token: "sdk-token" },
            } as any);

            vi.mocked(sha256).mockReturnValue("0xhash");
            vi.mocked(base64urlEncode).mockReturnValue("encoded-backup");

            const { pushBackupData } = await import("./backup");
            await pushBackupData({ domain: "example.com" });

            // Verify the encoded data includes both sessions
            const encodeCall = vi.mocked(base64urlEncode).mock.calls[0];
            expect(encodeCall).toBeDefined();
            const encodedJson = new TextDecoder().decode(
                encodeCall[0] as Uint8Array
            );
            const parsed = JSON.parse(encodedJson);
            expect(parsed.session.token).toBe("valid-token");
            expect(parsed.sdkSession.token).toBe("sdk-token");
            expect(parsed.domain).toBe("example.com");
            expect(parsed.validationHash).toBe("0xhash");
            expect(parsed.expireAtTimestamp).toBeGreaterThan(Date.now());

            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "do-backup",
                data: { backup: "encoded-backup" },
            });
        });
    });
});
