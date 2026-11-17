import { describe, expect, it } from "vitest";
import { parseDrawSearch } from "./drawSearch";

const GAME = "5b0a6c1e-6a52-4b1c-9d3e-0f6f2d9a7c11";

describe("parseDrawSearch", () => {
    it("keeps a game id and a pid", () => {
        expect(parseDrawSearch({ game: GAME, pid: "ab12" })).toEqual({
            game: GAME,
            pid: "ab12",
        });
    });

    it("lowercases the game id, which the backend reads byte for byte", () => {
        expect(parseDrawSearch({ game: GAME.toUpperCase() }).game).toBe(GAME);
    });

    it("drops a game that is not a UUID", () => {
        expect(parseDrawSearch({ game: "g1" }).game).toBeUndefined();
        expect(parseDrawSearch({ game: 42 }).game).toBeUndefined();
        expect(parseDrawSearch({}).game).toBeUndefined();
    });

    it("drops an empty or oversized pid", () => {
        expect(parseDrawSearch({ pid: "  " }).pid).toBeUndefined();
        expect(parseDrawSearch({ pid: "a".repeat(129) }).pid).toBeUndefined();
        expect(parseDrawSearch({ pid: 7 }).pid).toBeUndefined();
    });
});
