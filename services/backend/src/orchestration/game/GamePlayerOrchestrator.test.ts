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
const STARTS_AT = new Date("2026-10-01T00:00:00Z");
const ENDS_AT = new Date("2026-11-01T00:00:00Z");
const game = { startsAt: STARTS_AT, endsAt: ENDS_AT };
const JOINED_AT = new Date("2026-10-05T00:00:00Z");

function answer(...results: unknown[][][]) {
    for (const rows of results) {
        unsafe.mockReturnValueOnce({ values: async () => rows });
    }
}

function queryAt(index: number) {
    const call = unsafe.mock.calls[index];
    return { sql: call?.[0] as string, params: call?.[1] as unknown[] };
}

const flat = (sql: string) => sql.replace(/\s+/g, " ");

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

describe("GamePlayerOrchestrator.ticketsOf", () => {
    const player = new GamePlayerOrchestrator();

    beforeEach(() => unsafe.mockReset());

    it("counts the holder's own purchases at other merchants, not cancelled, in the window", async () => {
        answer([[0]], [[0]], [[0]], [[0]]);

        await player.ticketsOf(game, HOLDER, new Date("2026-10-05T00:00:00Z"));

        const { sql, params } = queryAt(0);
        expect(flat(sql)).toContain(
            'where ("interaction_logs"."identity_group_id" = $1 and "interaction_logs"."type" = $2 and "interaction_logs"."merchant_id" <> $3 and "interaction_logs"."cancelled_at" is null and "interaction_logs"."created_at" >= $4 and "interaction_logs"."created_at" < $5)'
        );
        expect(params).toEqual([
            HOLDER,
            "purchase",
            FRAK_MERCHANT_ID,
            new Date("2026-10-05T00:00:00Z").toISOString(),
            ENDS_AT.toISOString(),
        ]);
    });

    it("starts the window at the game start when the join predates it", async () => {
        answer([[0]], [[0]], [[0]], [[0]]);

        await player.ticketsOf(game, HOLDER, new Date("2026-09-20T00:00:00Z"));

        expect(queryAt(0).params[3]).toBe(STARTS_AT.toISOString());
    });

    it("counts purchases of the holder's active referees, merchant link first", async () => {
        answer([[0]], [[0]], [[0]], [[0]]);

        await player.ticketsOf(game, HOLDER, new Date("2026-10-05T00:00:00Z"));

        const { sql, params } = queryAt(1);
        const text = flat(sql);
        expect(text).toContain('count(distinct "interaction_logs"."id")');
        expect(text).toContain(
            '"interaction_logs"."type" = $2 and "interaction_logs"."merchant_id" <> $3 and "interaction_logs"."cancelled_at" is null and "interaction_logs"."created_at" >= $4 and "interaction_logs"."created_at" < $5'
        );
        expect(params.slice(1, 5)).toEqual([
            "purchase",
            FRAK_MERCHANT_ID,
            new Date("2026-10-05T00:00:00Z").toISOString(),
            ENDS_AT.toISOString(),
        ]);
        expect(text).toContain(
            '"referral_links"."referrer_identity_group_id" = $1'
        );
        expect(text).toContain('"referral_links"."removed_at" is null');
        expect(text).toContain(
            '"referral_links"."created_at" <= "interaction_logs"."created_at"'
        );
        expect(text).toContain(
            '("referral_links"."scope" = $6 and "referral_links"."merchant_id" = "interaction_logs"."merchant_id")'
        );
        expect(text).toContain(
            '"referral_links"."scope" = $7 and not exists (select 1 from "referral_links" "shadow" where ("shadow"."referee_identity_group_id" = "interaction_logs"."identity_group_id" and "shadow"."scope" = $8 and "shadow"."merchant_id" = "interaction_logs"."merchant_id" and "shadow"."removed_at" is null and "shadow"."created_at" <= "interaction_logs"."created_at"))'
        );
        expect(params).toContain(FRAK_MERCHANT_ID);
        expect(params.slice(5)).toEqual([
            "merchant",
            "cross_merchant",
            "merchant",
        ]);
    });

    it("grants the join ticket, 3 per own purchase and 3 per referred purchase", async () => {
        answer([[2]], [[1]], [[0]], [[0]]);

        await expect(player.ticketsOf(game, HOLDER, JOINED_AT)).resolves.toBe(
            10
        );
    });

    it("returns the join ticket alone when nothing else qualifies", async () => {
        answer([[0]], [[0]], [[0]], [[0]]);

        await expect(player.ticketsOf(game, HOLDER, JOINED_AT)).resolves.toBe(
            1
        );
    });

    it("counts friends who signed up with the holder's code in the window and follow @frak_fr", async () => {
        answer([[0]], [[0]], [[0]], [[0]]);

        await player.ticketsOf(game, HOLDER, JOINED_AT);

        const { sql, params } = queryAt(2);
        const text = flat(sql);
        expect(text).toContain(
            'count(distinct "interaction_logs"."identity_group_id")'
        );
        expect(text).toContain(
            'inner join "referral_links" on "referral_links"."referee_identity_group_id" = "interaction_logs"."identity_group_id"'
        );
        expect(text).toContain(
            'inner join "instagram_links" on "instagram_links"."identity_group_id" = "interaction_logs"."identity_group_id"'
        );
        expect(text).toContain(
            'where ("interaction_logs"."type" = $1 and "interaction_logs"."merchant_id" = $2 and "interaction_logs"."created_at" >= $3 and "interaction_logs"."created_at" < $4 and "referral_links"."referrer_identity_group_id" = $5 and "referral_links"."scope" = $6 and "referral_links"."removed_at" is null and "instagram_links"."follows" = $7)'
        );
        expect(params).toEqual([
            "referral_signup",
            FRAK_MERCHANT_ID,
            JOINED_AT.toISOString(),
            ENDS_AT.toISOString(),
            HOLDER,
            "cross_merchant",
            true,
        ]);
    });

    it("grants 1 ticket per friend who signed up and follows @frak_fr, on top of the join ticket", async () => {
        answer([[0]], [[0]], [[2]], [[0]]);

        await expect(player.ticketsOf(game, HOLDER, JOINED_AT)).resolves.toBe(
            3
        );
    });

    it("counts distinct friends with a wallet reached through the holder's brand links in the window", async () => {
        answer([[0]], [[0]], [[0]], [[0]]);

        await player.ticketsOf(game, HOLDER, JOINED_AT);

        const { sql, params } = queryAt(3);
        const text = flat(sql);
        expect(text).toContain(
            'select count(distinct "referee_identity_group_id") from "referral_links"'
        );
        expect(text).toContain(
            'where ("referral_links"."referrer_identity_group_id" = $1 and "referral_links"."scope" = $2 and "referral_links"."merchant_id" <> $3 and "referral_links"."removed_at" is null and "referral_links"."created_at" >= $4 and "referral_links"."created_at" < $5 and exists (select 1 from "identity_nodes" where ("identity_nodes"."group_id" = "referral_links"."referee_identity_group_id" and "identity_nodes"."identity_type" = $6 and "identity_nodes"."unlinked_at" is null)))'
        );
        expect(params).toEqual([
            HOLDER,
            "merchant",
            FRAK_MERCHANT_ID,
            JOINED_AT.toISOString(),
            ENDS_AT.toISOString(),
            "wallet",
        ]);
    });

    it("grants 1 ticket per distinct brand-share friend with a wallet", async () => {
        answer([[0]], [[0]], [[0]], [[3]]);

        await expect(player.ticketsOf(game, HOLDER, JOINED_AT)).resolves.toBe(
            4
        );
    });

    it("adds the join, purchase, signup and brand-share tickets", async () => {
        answer([[1]], [[1]], [[1]], [[1]]);

        await expect(player.ticketsOf(game, HOLDER, JOINED_AT)).resolves.toBe(
            9
        );
    });
});
