import { beforeEach, describe, expect, it, vi } from "vitest";
import { FRAK_MERCHANT_ID } from "../../domain/merchant/constants";
import { GamePlayerOrchestrator } from "./GamePlayerOrchestrator";

const { unsafe } = vi.hoisted(() => ({ unsafe: vi.fn() }));

vi.mock("../../infrastructure/persistence/postgres", async () => {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = {
        unsafe,
        options: { parsers: {}, serializers: {} },
    };
    return { db: drizzle({ client: client as never }) };
});

const HOLDER = "holder-group";

function answer(...results: unknown[][][]) {
    for (const rows of results) {
        unsafe.mockReturnValueOnce({ values: async () => rows });
    }
}

function queryAt(index: number) {
    const call = unsafe.mock.calls[index];
    return { sql: call?.[0] as string, params: call?.[1] as unknown[] };
}

describe("GamePlayerOrchestrator.joinedAt", () => {
    const player = new GamePlayerOrchestrator();

    beforeEach(() => unsafe.mockReset());

    it("filters the group's game_join interactions of the game on the Frak merchant", async () => {
        answer([[null]]);

        await player.joinedAt("game-1", HOLDER);

        const { sql, params } = queryAt(0);
        expect(sql).toContain('min("created_at")');
        expect(sql).toContain('"identity_group_id" = $1');
        expect(sql).toContain('"merchant_id" = $2');
        expect(sql).toContain('"type" = $3');
        expect(sql).toContain(`"payload"->>'gameId' = $4`);
        expect(params).toEqual([
            HOLDER,
            FRAK_MERCHANT_ID,
            "game_join",
            "game-1",
        ]);
    });

    it("returns null when the group never joined", async () => {
        answer([[null]]);

        await expect(player.joinedAt("game-1", HOLDER)).resolves.toBeNull();
    });

    it("returns the earliest join date", async () => {
        answer([["2026-10-02 10:00:00"]]);

        await expect(player.joinedAt("game-1", HOLDER)).resolves.toEqual(
            new Date("2026-10-02T10:00:00Z")
        );
    });
});
