import { beforeEach, describe, expect, it, vi } from "vitest";
import { MissionUnlockOrchestrator } from "./MissionUnlockOrchestrator";

const { unsafe } = vi.hoisted(() => ({ unsafe: vi.fn() }));

vi.mock("@backend-infrastructure", () => ({ log: { info: vi.fn() } }));

vi.mock("../../infrastructure/persistence/postgres", async () => {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = {
        unsafe,
        options: { parsers: {}, serializers: {} },
    };
    return { db: drizzle({ client: client as never }) };
});

const flat = (sql: string) => sql.replace(/\s+/g, " ");

function sqlAt(index: number) {
    return flat(unsafe.mock.calls[index]?.[0] as string);
}

function whereOf(sql: string) {
    return sql.slice(sql.indexOf(" where ("));
}

describe("MissionUnlockOrchestrator.run", () => {
    const assetLogRepository = {
        releaseHeld: vi.fn().mockResolvedValue(0),
        reholdReleased: vi.fn().mockResolvedValue(0),
    };
    const orchestrator = new MissionUnlockOrchestrator(
        assetLogRepository as never
    );

    beforeEach(() => {
        unsafe.mockReset();
        unsafe.mockReturnValue({ values: async () => [] });
    });

    it("releases a held reward on a brand reward or a follow of the subject", async () => {
        await orchestrator.run();

        const release = whereOf(sqlAt(0));
        expect(release).toContain('"released_at" is null');
        expect(release).toContain(
            '(exists (select 1 from "asset_logs" "mission_reward"'
        );
        expect(release).toContain(
            'or exists (select 1 from "instagram_links" where ("instagram_links"."identity_group_id" = CASE WHEN'
        );
        expect(release).toContain('"instagram_links"."follows" = $');
    });

    it("makes a follow release payable at once", async () => {
        await orchestrator.run();

        expect(sqlAt(0)).toContain(
            `NULLIF(LEAST(((select MIN(COALESCE("available_at", '-infinity'::timestamp)) from "asset_logs" "mission_reward"`
        );
        expect(sqlAt(0)).toContain(
            "THEN '-infinity'::timestamp END), '-infinity'::timestamp)"
        );
    });

    it("holds a released reward again only when no brand reward and no Instagram link is left", async () => {
        await orchestrator.run();

        const lapse = whereOf(sqlAt(1));
        expect(lapse).toContain('"released_at" is not null');
        expect(lapse).toContain(
            'not (exists (select 1 from "asset_logs" "mission_reward"'
        );
        expect(lapse).toMatch(
            /or exists \(select 1 from "instagram_links" where "instagram_links"\."identity_group_id" = CASE WHEN .*? END\)\)\)$/
        );
        expect(lapse).not.toContain('"instagram_links"."follows"');
    });
});
