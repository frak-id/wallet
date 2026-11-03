import { describe, expect, it, vi } from "vitest";
import { WALLET } from "../../../../test/mock/monerium";
import { firstQuery } from "../../../../test/mock/queryLog";
import { MoneriumPendingAuthRepository } from "./MoneriumPendingAuthRepository";

const { queries } = vi.hoisted(() => ({
    queries: [] as { sql: string; params: unknown[] }[],
}));

vi.mock("@backend-infrastructure", async () =>
    (await import("../../../../test/mock/queryLog")).infrastructureWithQueryLog(
        queries
    )
);

describe("MoneriumPendingAuthRepository.consume", () => {
    it("spends a state in one DELETE bound to the wallet that started it", async () => {
        const { sql } = await firstQuery(queries, () =>
            new MoneriumPendingAuthRepository().consume("state-1", WALLET)
        );

        expect(sql).toMatch(
            /^delete from "monerium_pending_auths" where \("monerium_pending_auths"\."state" = \$1 and "monerium_pending_auths"\."wallet" = \$2\) returning /
        );
    });
});
