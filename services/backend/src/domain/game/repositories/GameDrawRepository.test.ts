import { beforeEach, describe, expect, it, vi } from "vitest";
import { NO_TICKETS } from "../tickets";
import { GameDrawRepository } from "./GameDrawRepository";

const { unsafe } = vi.hoisted(() => ({ unsafe: vi.fn() }));

vi.mock("../../../infrastructure/persistence/postgres", async () => {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = {
        unsafe,
        options: { parsers: {}, serializers: {} },
    };
    return { db: drizzle({ client: client as never }) };
});

function answer(...results: unknown[][][]) {
    for (const rows of results) {
        unsafe.mockReturnValueOnce({ values: async () => rows });
    }
}

const entry = (identityGroupId: string, drawTickets: number) => ({
    pid: `pid-${identityGroupId}`,
    identityGroupId,
    tickets: { ...NO_TICKETS, join: drawTickets },
    drawTickets,
    discarded: null,
});

const drawState = ["draw-1", "game-1", "drawn", 3, null, null];

describe("GameDrawRepository.findOutcomes", () => {
    beforeEach(() => unsafe.mockReset());

    it("finds the caller's line through any of their groups", async () => {
        const repository = new GameDrawRepository();
        answer([drawState], [[[entry("other", 2), entry("absorbed", 1)]]]);

        const [outcome] = await repository.findOutcomes(
            ["game-1"],
            ["me", "absorbed"]
        );

        expect(outcome).toMatchObject({
            gameId: "game-1",
            status: "drawn",
            totalTickets: 3,
            participants: 2,
            entry: { pid: "pid-absorbed", drawTickets: 1 },
        });
    });

    it("reads a draw's entries once, whoever asks next", async () => {
        const repository = new GameDrawRepository();
        answer([drawState], [[[entry("me", 2), entry("you", 1)]]], [drawState]);

        await repository.findOutcomes(["game-1"], ["me"]);
        const [outcome] = await repository.findOutcomes(["game-1"], ["you"]);

        expect(unsafe).toHaveBeenCalledTimes(3);
        expect(outcome?.entry).toMatchObject({ pid: "pid-you" });
    });

    it("gives no line to someone outside the draw", async () => {
        const repository = new GameDrawRepository();
        answer([drawState], [[[entry("other", 2)]]]);

        const [outcome] = await repository.findOutcomes(["game-1"], ["me"]);

        expect(outcome?.entry).toBeNull();
    });
});
