import { sha256Hex } from "@backend-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InstagramAccessTokenSelect } from "../db/schema";
import { InstagramTokenCipher } from "./InstagramTokenCipher";
import { InstagramTokenService } from "./InstagramTokenService";

vi.mock("@backend-infrastructure", () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-28T10:00:00Z");
const SEED = "seed-token";

const cipher = new InstagramTokenCipher({
    deriveKeyBytes: async () => new Uint8Array(32).fill(7),
});

function setup(row: InstagramAccessTokenSelect | null = null) {
    let stored = row;
    const repository = {
        find: vi.fn(async () => stored),
        save: vi.fn(
            async (next: Omit<InstagramAccessTokenSelect, "updatedAt">) => {
                stored = { ...next, updatedAt: NOW };
            }
        ),
    };
    const graph = { refreshToken: vi.fn() };
    const service = new InstagramTokenService(
        repository as never,
        cipher,
        graph
    );
    return { repository, graph, service, stored: () => stored };
}

async function storedRow(
    token: string,
    overrides: Partial<InstagramAccessTokenSelect> = {}
): Promise<InstagramAccessTokenSelect> {
    return {
        account: "frak",
        tokenEncrypted: await cipher.encrypt(token, "frak"),
        seedHash: sha256Hex(SEED),
        refreshedAt: NOW,
        expiresAt: null,
        updatedAt: NOW,
        ...overrides,
    };
}

describe("InstagramTokenService", () => {
    beforeEach(() => {
        vi.stubEnv("INSTAGRAM_APP_SECRET", "secret");
        vi.stubEnv("INSTAGRAM_WEBHOOK_VERIFY_TOKEN", "verify");
        vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", SEED);
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(NOW);
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.useRealTimers();
    });

    it("is off when certification is not configured", async () => {
        vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "");
        const { service } = setup();

        await expect(service.current()).resolves.toBeNull();
        await expect(service.refreshIfDue(NOW)).resolves.toBe("none");
    });

    it("stores the env token encrypted on first use", async () => {
        const { service, stored } = setup();

        await expect(service.current()).resolves.toBe(SEED);
        const row = stored();
        expect(row?.seedHash).toBe(sha256Hex(SEED));
        expect(row?.tokenEncrypted).not.toContain(SEED);
        await expect(
            cipher.decrypt(row?.tokenEncrypted ?? "", "frak")
        ).resolves.toBe(SEED);
    });

    it("serves the renewed token while the env still holds the first one", async () => {
        const { service, repository } = setup(await storedRow("renewed"));

        await expect(service.current()).resolves.toBe("renewed");
        expect(repository.save).not.toHaveBeenCalled();
    });

    it("takes a token rotated by hand in the env over the stored one", async () => {
        vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "rotated");
        const { service } = setup(await storedRow("renewed"));

        await expect(service.current()).resolves.toBe("rotated");
    });

    it("leaves a token younger than a week alone", async () => {
        const { service, graph } = setup(
            await storedRow(SEED, {
                refreshedAt: new Date(NOW.getTime() - 6 * DAY),
            })
        );

        await expect(service.refreshIfDue(NOW)).resolves.toBe("fresh");
        expect(graph.refreshToken).not.toHaveBeenCalled();
    });

    it("renews a week-old token and serves the new one", async () => {
        const { service, graph, stored } = setup(
            await storedRow(SEED, {
                refreshedAt: new Date(NOW.getTime() - 7 * DAY),
            })
        );
        graph.refreshToken.mockResolvedValue({
            token: "renewed",
            expiresInSeconds: 60 * 24 * 3600,
        });

        await expect(service.refreshIfDue(NOW)).resolves.toBe("refreshed");

        expect(graph.refreshToken).toHaveBeenCalledWith(SEED);
        expect(stored()).toMatchObject({
            seedHash: sha256Hex(SEED),
            refreshedAt: NOW,
            expiresAt: new Date(NOW.getTime() + 60 * DAY),
        });
        await expect(service.current()).resolves.toBe("renewed");
    });

    it("keeps the stored token when Meta refuses the renewal", async () => {
        const row = await storedRow(SEED, {
            refreshedAt: new Date(NOW.getTime() - 8 * DAY),
        });
        const { service, graph, repository } = setup(row);
        graph.refreshToken.mockResolvedValue(null);

        await expect(service.refreshIfDue(NOW)).resolves.toBe("failed");
        expect(repository.save).not.toHaveBeenCalled();
    });
});

describe("InstagramTokenCipher", () => {
    it("does not decrypt a blob moved to another account", async () => {
        const blob = await cipher.encrypt("token", "frak");

        await expect(cipher.decrypt(blob, "other")).rejects.toThrow();
    });

    it("does not decrypt under another key", async () => {
        const other = new InstagramTokenCipher({
            deriveKeyBytes: async () => new Uint8Array(32).fill(8),
        });
        const blob = await cipher.encrypt("token", "frak");

        await expect(other.decrypt(blob, "frak")).rejects.toThrow();
    });
});
