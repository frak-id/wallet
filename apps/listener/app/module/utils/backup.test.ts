import { beforeEach, describe, expect, test, vi } from "vitest";

// Use the real base64url helpers so the round-trip stays faithful end-to-end:
// the listener serialises with `base64urlEncode`, the SDK round-trips that
// string into localStorage, and the listener decodes the same bytes back.
vi.mock("@frak-labs/core-sdk", () => {
    function base64urlEncode(bytes: Uint8Array): string {
        let bin = "";
        for (let i = 0; i < bytes.length; i++)
            bin += String.fromCharCode(bytes[i] as number);
        return btoa(bin)
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    }
    function base64urlDecode(str: string): Uint8Array {
        const pad =
            str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
        const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }
    return { base64urlEncode, base64urlDecode };
});

vi.mock("@frak-labs/wallet-shared/common/utils/lifecycleEvents", () => ({
    emitLifecycleEvent: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared/stores/sessionStore", () => ({
    sessionStore: {
        getState: vi.fn(),
    },
}));

describe("backup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * The hashing implementation must stay byte-identical to the original
     * `viem.sha256(new TextEncoder().encode(JSON.stringify(...)))` so existing
     * customer backups keep validating after the migration to
     * `crypto.subtle.digest`. These vectors lock that contract down.
     */
    describe("hashJson", () => {
        test("matches the byte-identical viem.sha256 contract for known vectors", async () => {
            const { hashJson } = await import("./backup");

            // Vectors generated once via `viem.sha256(new TextEncoder().encode(JSON.stringify(...)))`.
            // If any of these regresses we have broken the legacy backup contract.
            const cases: [unknown, string][] = [
                [
                    {},
                    "0x44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
                ],
                [
                    { foo: "bar" },
                    "0x7a38bf81f383f69433ad6e900d35b3e2385593f76a7b7ab5d4355b8ba41ee24b",
                ],
                [
                    {
                        domain: "example.com",
                        session: { address: "0xabc", token: "t" },
                    },
                    "0x98e80ab8105cad2bc5e921fbb13c137b87fa574bb951640da66ae879ea864df5",
                ],
                [
                    { unicode: "café 🥐", n: 42, nested: { a: [1, 2, 3] } },
                    "0x7c67b69c375337174354afd6f004357106c12101c8584b3f5f9c76103a0f53c7",
                ],
            ];

            for (const [input, expected] of cases) {
                expect(await hashJson(input)).toBe(expected);
            }
        });

        test("matches a real customer backup payload (regression vector)", async () => {
            const { hashJson } = await import("./backup");

            // Captured from a freshly-generated production backup on
            // ethcc.frak-labs.com — pre-migration code emitted exactly
            // `validationHash` for this payload, and we must keep doing so.
            const backup = {
                session: {
                    type: "webauthn",
                    address: "0xDE5d8918B20cE8076aC5507f7Eca7BF8914b08f9",
                    authenticatorId: "5Eb79DVKfGJlU0zJOwsgyKMwxDA",
                    publicKey: {
                        x: "0x1fa7993fcebb0432ad6df6c6d249042eb9a3bf0f674093306ad69319a877d40b",
                        y: "0x65dba26d299edd884a002ec8d1e428fc2a1e9c5d48def87bcc849cacef860f71",
                    },
                    transports: ["hybrid", "internal"],
                    token: "eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJmcmFrLmlkIiwidHlwZSI6IndlYmF1dGhuIiwiYWRkcmVzcyI6IjB4REU1ZDg5MThCMjBjRTgwNzZhQzU1MDdmN0VjYTdCRjg5MTRiMDhmOSIsImF1dGhlbnRpY2F0b3JJZCI6IjVFYjc5RFZLZkdKbFUwekpPd3NneUtNd3hEQSIsInB1YmxpY0tleSI6eyJ4IjoiMHgxZmE3OTkzZmNlYmIwNDMyYWQ2ZGY2YzZkMjQ5MDQyZWI5YTNiZjBmNjc0MDkzMzA2YWQ2OTMxOWE4NzdkNDBiIiwieSI6IjB4NjVkYmEyNmQyOTllZGQ4ODRhMDAyZWM4ZDFlNDI4ZmMyYTFlOWM1ZDQ4ZGVmODdiY2M4NDljYWNlZjg2MGY3MSJ9LCJ0cmFuc3BvcnRzIjpbImh5YnJpZCIsImludGVybmFsIl0sInN1YiI6IjB4REU1ZDg5MThCMjBjRTgwNzZhQzU1MDdmN0VjYTdCRjg5MTRiMDhmOSIsImlhdCI6MTc3ODEzOTU5MjA1MiwiZXhwIjoxNzgwNzMxNTkyfQ.X4Y8LU9t8BKZBp_etayxV6Cp5g5tDewW-jY4-Ib7xdw",
                },
                sdkSession: {
                    token: "eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJmcmFrLmlkIiwiYWRkcmVzcyI6IjB4REU1ZDg5MThCMjBjRTgwNzZhQzU1MDdmN0VjYTdCRjg5MTRiMDhmOSIsInNjb3BlcyI6WyJpbnRlcmFjdGlvbiJdLCJzdWIiOiIweERFNWQ4OTE4QjIwY0U4MDc2YUM1NTA3ZjdFY2E3QkY4OTE0YjA4ZjkiLCJpYXQiOjE3NzgxMzk1OTIwNTIsImV4cCI6MTc3ODc0NDM5Mn0.IPY0GGp4wdj-ZMuRZhZ3kpDb6Nx_QY5Bcih4MA-Jf8c",
                    expires: 1778744392052,
                },
                domain: "ethcc.frak-labs.com",
                expireAtTimestamp: 1778840779201,
            };

            expect(await hashJson(backup)).toBe(
                "0x52c5b0e0321dca560fad6f5bddb3c1184a186dcf37b92484216050d619dddf1f"
            );
        });
    });

    describe("restoreBackupData", () => {
        async function buildEncodedBackup(
            backup: Record<string, unknown>,
            overrideHash?: string
        ): Promise<string> {
            const { hashJson } = await import("./backup");
            const { base64urlEncode } = await import("@frak-labs/core-sdk");
            const validationHash = overrideHash ?? (await hashJson(backup));
            const hashProtected = { ...backup, validationHash };
            return base64urlEncode(
                new TextEncoder().encode(JSON.stringify(hashProtected))
            );
        }

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

            const { sessionStore } = await import(
                "@frak-labs/wallet-shared/stores/sessionStore"
            );
            const setSession = vi.fn();
            const setSdkSession = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                setSession,
                setSdkSession,
            } as never);

            const encoded = await buildEncodedBackup(backupData);

            const { restoreBackupData } = await import("./backup");
            await restoreBackupData({ backup: encoded, domain: "example.com" });

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

            const { sessionStore } = await import(
                "@frak-labs/wallet-shared/stores/sessionStore"
            );
            const setSession = vi.fn();
            const setSdkSession = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                setSession,
                setSdkSession,
            } as never);

            const encoded = await buildEncodedBackup(backupData);

            const { restoreBackupData } = await import("./backup");
            await restoreBackupData({ backup: encoded, domain: "example.com" });

            expect(setSession).toHaveBeenCalledWith(mockSession);
            expect(setSdkSession).not.toHaveBeenCalled();
        });

        test("should not restore session without token", async () => {
            const backupData = {
                domain: "example.com",
                session: { address: "0x123", token: "" },
                expireAtTimestamp: Date.now() + 1000 * 60 * 60,
            };

            const { sessionStore } = await import(
                "@frak-labs/wallet-shared/stores/sessionStore"
            );
            const setSession = vi.fn();
            const setSdkSession = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                setSession,
                setSdkSession,
            } as never);

            const encoded = await buildEncodedBackup(backupData);

            const { restoreBackupData } = await import("./backup");
            await restoreBackupData({ backup: encoded, domain: "example.com" });

            expect(setSession).not.toHaveBeenCalled();
            expect(setSdkSession).not.toHaveBeenCalled();
        });

        test("should throw on domain mismatch", async () => {
            const backupData = {
                domain: "other.com",
                session: { address: "0x123", token: "tok" },
                expireAtTimestamp: Date.now() + 1000 * 60 * 60,
            };

            const encoded = await buildEncodedBackup(backupData);

            const { restoreBackupData } = await import("./backup");
            await expect(
                restoreBackupData({
                    backup: encoded,
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

            const { emitLifecycleEvent } = await import(
                "@frak-labs/wallet-shared/common/utils/lifecycleEvents"
            );
            const { sessionStore } = await import(
                "@frak-labs/wallet-shared/stores/sessionStore"
            );
            const setSession = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                setSession,
            } as never);

            const encoded = await buildEncodedBackup(backupData);

            const { restoreBackupData } = await import("./backup");
            await restoreBackupData({ backup: encoded, domain: "example.com" });

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

            const { sessionStore } = await import(
                "@frak-labs/wallet-shared/stores/sessionStore"
            );
            const setSession = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                setSession,
            } as never);

            // Force a wrong hash so the validation rejects.
            const encoded = await buildEncodedBackup(backupData, "0xwrong");

            const { restoreBackupData } = await import("./backup");
            await restoreBackupData({ backup: encoded, domain: "example.com" });

            expect(setSession).not.toHaveBeenCalled();
        });

        test("should return early on malformed base64", async () => {
            const { sessionStore } = await import(
                "@frak-labs/wallet-shared/stores/sessionStore"
            );
            const setSession = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                setSession,
            } as never);

            const { restoreBackupData } = await import("./backup");
            await restoreBackupData({
                backup: "!@#$%^not-valid-base64",
                domain: "example.com",
            });

            expect(setSession).not.toHaveBeenCalled();
        });
    });

    describe("pushBackupData", () => {
        test("should return early when no domain provided", async () => {
            const { emitLifecycleEvent } = await import(
                "@frak-labs/wallet-shared/common/utils/lifecycleEvents"
            );

            const { pushBackupData } = await import("./backup");
            await pushBackupData();

            expect(emitLifecycleEvent).not.toHaveBeenCalled();
        });

        test("should return early when domain is undefined", async () => {
            const { emitLifecycleEvent } = await import(
                "@frak-labs/wallet-shared/common/utils/lifecycleEvents"
            );

            const { pushBackupData } = await import("./backup");
            await pushBackupData({ domain: undefined });

            expect(emitLifecycleEvent).not.toHaveBeenCalled();
        });

        test("should emit remove-backup when no session tokens exist", async () => {
            const { emitLifecycleEvent } = await import(
                "@frak-labs/wallet-shared/common/utils/lifecycleEvents"
            );
            const { sessionStore } = await import(
                "@frak-labs/wallet-shared/stores/sessionStore"
            );

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: { address: "0x123", token: "" },
                sdkSession: { token: "" },
            } as never);

            const { pushBackupData } = await import("./backup");
            await pushBackupData({ domain: "example.com" });

            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "remove-backup",
            });
        });

        test("should emit remove-backup when no sessions at all", async () => {
            const { emitLifecycleEvent } = await import(
                "@frak-labs/wallet-shared/common/utils/lifecycleEvents"
            );
            const { sessionStore } = await import(
                "@frak-labs/wallet-shared/stores/sessionStore"
            );

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: undefined,
                sdkSession: undefined,
            } as never);

            const { pushBackupData } = await import("./backup");
            await pushBackupData({ domain: "example.com" });

            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "remove-backup",
            });
        });

        test("should encode and emit do-backup with a valid hash that round-trips through restoreBackupData", async () => {
            const { emitLifecycleEvent } = await import(
                "@frak-labs/wallet-shared/common/utils/lifecycleEvents"
            );
            const { sessionStore } = await import(
                "@frak-labs/wallet-shared/stores/sessionStore"
            );

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: { address: "0x123", token: "valid-token" },
                sdkSession: undefined,
            } as never);

            const { pushBackupData } = await import("./backup");
            await pushBackupData({ domain: "example.com" });

            expect(emitLifecycleEvent).toHaveBeenCalledWith(
                expect.objectContaining({ iframeLifecycle: "do-backup" })
            );

            // Round-trip: feed the produced backup straight back into
            // restoreBackupData and confirm the session is restored. This is
            // the strongest guarantee that the new crypto.subtle hash matches
            // the verification path.
            const emittedCall = vi.mocked(emitLifecycleEvent).mock.calls[0];
            const emittedEvent = emittedCall?.[0] as
                | { data?: { backup?: string } }
                | undefined;
            const emittedBackup = emittedEvent?.data?.backup;
            expect(emittedBackup).toBeDefined();

            const setSession = vi.fn();
            const setSdkSession = vi.fn();
            vi.mocked(sessionStore.getState).mockReturnValue({
                setSession,
                setSdkSession,
            } as never);

            const { restoreBackupData } = await import("./backup");
            await restoreBackupData({
                backup: emittedBackup as string,
                domain: "example.com",
            });

            expect(setSession).toHaveBeenCalledWith({
                address: "0x123",
                token: "valid-token",
            });
        });

        test("should include both session and sdkSession when both have tokens", async () => {
            const { emitLifecycleEvent } = await import(
                "@frak-labs/wallet-shared/common/utils/lifecycleEvents"
            );
            const { sessionStore } = await import(
                "@frak-labs/wallet-shared/stores/sessionStore"
            );
            const { base64urlDecode } = await import("@frak-labs/core-sdk");

            vi.mocked(sessionStore.getState).mockReturnValue({
                session: { address: "0x123", token: "valid-token" },
                sdkSession: { token: "sdk-token" },
            } as never);

            const { pushBackupData } = await import("./backup");
            await pushBackupData({ domain: "example.com" });

            const emittedCall = vi.mocked(emitLifecycleEvent).mock.calls[0];
            const emittedEvent = emittedCall?.[0] as
                | { data?: { backup?: string } }
                | undefined;
            const emittedBackup = emittedEvent?.data?.backup;
            expect(emittedBackup).toBeDefined();

            const decoded = JSON.parse(
                new TextDecoder().decode(
                    base64urlDecode(emittedBackup as string)
                )
            );
            expect(decoded.session.token).toBe("valid-token");
            expect(decoded.sdkSession.token).toBe("sdk-token");
            expect(decoded.domain).toBe("example.com");
            expect(decoded.validationHash).toMatch(/^0x[0-9a-f]{64}$/);
            expect(decoded.expireAtTimestamp).toBeGreaterThan(Date.now());

            expect(emitLifecycleEvent).toHaveBeenCalledWith({
                iframeLifecycle: "do-backup",
                data: { backup: emittedBackup },
            });
        });
    });
});
