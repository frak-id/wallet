import { describe, expect, it, vi } from "vitest";
import { AdminWalletsRepository } from "../../../infrastructure/keys/AdminWalletsRepository";
import type { MoneriumConnectionRow } from "../db/schema";
import { MoneriumApiError } from "../errors";
import type {
    MoneriumConnectionPatch,
    MoneriumConnectionRepository,
} from "../repositories/MoneriumConnectionRepository";
import type { MoneriumApiClient } from "./MoneriumApiClient";
import { MoneriumTokenCipher } from "./MoneriumTokenCipher";
import { MoneriumTokenService } from "./MoneriumTokenService";

const WALLET = "0x0000000000000000000000000000000000000001" as const;
const cipher = new MoneriumTokenCipher(new AdminWalletsRepository());

async function connectionRow(
    overrides: Partial<MoneriumConnectionRow> = {}
): Promise<MoneriumConnectionRow> {
    return {
        wallet: WALLET,
        moneriumUserId: null,
        profileId: null,
        profileKind: null,
        profileState: null,
        profileReasonCode: null,
        walletLinkState: "none",
        status: "connected",
        accessTokenEncrypted: await cipher.encrypt("access-old"),
        accessTokenExpiresAt: new Date(Date.now() + 30_000),
        refreshTokenEncrypted: await cipher.encrypt("refresh-old"),
        siweFailedAt: null,
        stateCheckedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

/** In-memory stand-in for the row lock: a throwing task rolls its writes back. */
function fakeConnections(initial: MoneriumConnectionRow) {
    let row: MoneriumConnectionRow | undefined = initial;
    const repository = {
        findByWallet: vi.fn(async () => row),
        withLockedConnection: vi.fn(
            async (
                _wallet: string,
                task: (
                    locked: MoneriumConnectionRow | undefined,
                    write: (patch: MoneriumConnectionPatch) => Promise<void>
                ) => Promise<unknown>
            ) => {
                const snapshot = row;
                try {
                    return await task(row, async (patch) => {
                        if (row) row = { ...row, ...patch };
                    });
                } catch (error) {
                    row = snapshot;
                    throw error;
                }
            }
        ),
    };
    return {
        repository: repository as unknown as MoneriumConnectionRepository,
        locked: repository.withLockedConnection,
        current: () => row,
    };
}

function fakeClient(refresh: MoneriumApiClient["refreshAccessToken"]) {
    return {
        refreshAccessToken: vi.fn(refresh),
    } as unknown as MoneriumApiClient & {
        refreshAccessToken: ReturnType<typeof vi.fn>;
    };
}

describe("MoneriumTokenService", () => {
    it("returns the stored token without locking while it is valid past the grace period", async () => {
        const store = fakeConnections(
            await connectionRow({
                accessTokenExpiresAt: new Date(Date.now() + 5 * 60_000),
            })
        );
        const client = fakeClient(async () => {
            throw new Error("must not refresh");
        });
        const service = new MoneriumTokenService(
            store.repository,
            cipher,
            client
        );

        await expect(service.getAccessToken(WALLET)).resolves.toBe(
            "access-old"
        );
        expect(store.locked).not.toHaveBeenCalled();
    });

    it("refreshes inside the lock when the token is within the 60 s grace and persists the rotated pair", async () => {
        const store = fakeConnections(await connectionRow());
        const client = fakeClient(async (refreshToken) => {
            expect(refreshToken).toBe("refresh-old");
            return {
                accessToken: "access-new",
                refreshToken: "refresh-new",
                expiresInSeconds: 3600,
            };
        });
        const service = new MoneriumTokenService(
            store.repository,
            cipher,
            client
        );

        await expect(service.getAccessToken(WALLET)).resolves.toBe(
            "access-new"
        );

        const saved = store.current();
        expect(await cipher.decrypt(saved?.accessTokenEncrypted ?? "")).toBe(
            "access-new"
        );
        expect(await cipher.decrypt(saved?.refreshTokenEncrypted ?? "")).toBe(
            "refresh-new"
        );
        expect(saved?.accessTokenExpiresAt?.getTime()).toBeGreaterThan(
            Date.now() + 3_000_000
        );
    });

    it("re-checks expiry after taking the lock and skips the refresh when another pod already did it", async () => {
        const stale = await connectionRow();
        const fresh = await connectionRow({
            accessTokenEncrypted: await cipher.encrypt("access-from-other-pod"),
            accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
        });
        const client = fakeClient(async () => {
            throw new Error("must not refresh");
        });
        const repository = {
            findByWallet: vi.fn(async () => stale),
            withLockedConnection: vi.fn(
                async (
                    _wallet: string,
                    task: (
                        locked: MoneriumConnectionRow,
                        write: () => Promise<void>
                    ) => Promise<unknown>
                ) => task(fresh, async () => undefined)
            ),
        } as unknown as MoneriumConnectionRepository;

        const service = new MoneriumTokenService(repository, cipher, client);

        await expect(service.getAccessToken(WALLET)).resolves.toBe(
            "access-from-other-pod"
        );
        expect(client.refreshAccessToken).not.toHaveBeenCalled();
    });

    it("wipes the tokens and flags reauth_required on a 4xx refresh, keeping the profile cache", async () => {
        const store = fakeConnections(
            await connectionRow({
                profileId: "profile-1",
                profileKind: "personal",
                profileState: "approved",
                walletLinkState: "linked",
            })
        );
        const client = fakeClient(async () => {
            throw new MoneriumApiError(400, "invalid_grant", "Token expired");
        });
        const service = new MoneriumTokenService(
            store.repository,
            cipher,
            client
        );

        await expect(service.getAccessToken(WALLET)).rejects.toMatchObject({
            status: 409,
            code: "MONERIUM_REAUTH_REQUIRED",
        });

        expect(store.current()).toMatchObject({
            status: "reauth_required",
            accessTokenEncrypted: null,
            refreshTokenEncrypted: null,
            profileState: "approved",
            walletLinkState: "linked",
        });
        await expect(service.getAccessToken(WALLET)).rejects.toMatchObject({
            code: "MONERIUM_REAUTH_REQUIRED",
        });
    });

    it("keeps the tokens and rethrows when the refresh fails upstream", async () => {
        const store = fakeConnections(await connectionRow());
        const client = fakeClient(async () => {
            throw new MoneriumApiError(503, undefined, "down");
        });
        const service = new MoneriumTokenService(
            store.repository,
            cipher,
            client
        );

        await expect(service.getAccessToken(WALLET)).rejects.toMatchObject({
            status: 503,
        });
        expect(store.current()?.status).toBe("connected");
        expect(store.current()?.refreshTokenEncrypted).not.toBeNull();
    });

    it("treats a refresh token it cannot decrypt as a dead connection", async () => {
        const store = fakeConnections(
            await connectionRow({ refreshTokenEncrypted: "0x1234" })
        );
        const service = new MoneriumTokenService(
            store.repository,
            cipher,
            fakeClient(async () => {
                throw new Error("must not refresh");
            })
        );

        await expect(service.getAccessToken(WALLET)).rejects.toMatchObject({
            code: "MONERIUM_REAUTH_REQUIRED",
        });
        expect(store.current()?.status).toBe("reauth_required");
    });

    it("refreshes and retries once after a 401", async () => {
        const store = fakeConnections(
            await connectionRow({
                accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
            })
        );
        const client = fakeClient(async () => ({
            accessToken: "access-new",
            refreshToken: "refresh-new",
            expiresInSeconds: 3600,
        }));
        const service = new MoneriumTokenService(
            store.repository,
            cipher,
            client
        );
        const call = vi
            .fn<(token: string) => Promise<string>>()
            .mockRejectedValueOnce(new MoneriumApiError(401, undefined, "no"))
            .mockResolvedValueOnce("ok");

        await expect(service.withAccessToken(WALLET, call)).resolves.toBe("ok");
        expect(call.mock.calls.map(([token]) => token)).toEqual([
            "access-old",
            "access-new",
        ]);
    });

    it("does not retry twice on a persistent 401", async () => {
        const store = fakeConnections(
            await connectionRow({
                accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
            })
        );
        const service = new MoneriumTokenService(
            store.repository,
            cipher,
            fakeClient(async () => ({
                accessToken: "access-new",
                refreshToken: "refresh-new",
                expiresInSeconds: 3600,
            }))
        );
        const call = vi
            .fn<(token: string) => Promise<string>>()
            .mockRejectedValue(new MoneriumApiError(401, undefined, "no"));

        await expect(
            service.withAccessToken(WALLET, call)
        ).rejects.toMatchObject({ status: 401 });
        expect(call).toHaveBeenCalledTimes(2);
    });

    it("answers not connected without a row", async () => {
        const repository = {
            findByWallet: vi.fn(async () => undefined),
        } as unknown as MoneriumConnectionRepository;
        const service = new MoneriumTokenService(
            repository,
            cipher,
            fakeClient(async () => {
                throw new Error("unused");
            })
        );
        await expect(service.getAccessToken(WALLET)).rejects.toMatchObject({
            status: 409,
            code: "MONERIUM_NOT_CONNECTED",
        });
    });
});
