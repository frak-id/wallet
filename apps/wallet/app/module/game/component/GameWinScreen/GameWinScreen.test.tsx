import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { gameHistory, trackEvent } = vi.hoisted(() => ({
    gameHistory: { data: undefined as unknown[] | undefined },
    trackEvent: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared", () => ({ trackEvent }));
vi.mock("@/module/game/hook/useGameHistory", () => ({
    useGameHistory: () => gameHistory,
}));

import { gameWinStore } from "@/module/game/stores/gameWinStore";
import { modalStore } from "@/module/stores/modalStore";
import { gameResult } from "@/tests/gameFixtures";
import { GameWinScreen } from "./index";

const DAY = 24 * 60 * 60 * 1000;
const result = (
    id: string,
    outcome: "won" | "lost" | "drawing",
    confirmedDaysAgo = 1
) =>
    gameResult({
        game: { id },
        outcome,
        confirmedAt: new Date(Date.now() - confirmedDaysAgo * DAY),
    });

describe("GameWinScreen", () => {
    beforeEach(() => {
        trackEvent.mockClear();
        gameWinStore.setState({ celebrated: {} });
        modalStore.setState({ modal: null, stack: [] });
    });

    it("opens the win modal once for a fresh win, even under a double effect", () => {
        gameHistory.data = [result("g1", "won")];
        render(
            <StrictMode>
                <GameWinScreen />
            </StrictMode>
        );

        expect(modalStore.getState().modal).toMatchObject({
            id: "gameWin",
            result: { game: { id: "g1" } },
        });
        expect(modalStore.getState().stack).toEqual([]);
        expect(gameWinStore.getState().celebrated).toEqual({ g1: true });
        const viewed = trackEvent.mock.calls.filter(
            ([name]) => name === "game_win_screen_viewed"
        );
        expect(viewed).toEqual([
            ["game_win_screen_viewed", { game_id: "g1", prize_amount: 50 }],
        ]);
    });

    it("never opens a win this device already celebrated", () => {
        gameHistory.data = [result("g1", "won")];
        gameWinStore.setState({ celebrated: { g1: true } });

        render(<GameWinScreen />);

        expect(modalStore.getState().modal).toBeNull();
    });

    it.each([
        { name: "a lost game", results: [result("g1", "lost")] },
        { name: "a draw still running", results: [result("g1", "drawing")] },
        { name: "a win over a month old", results: [result("g1", "won", 31)] },
    ])("stays closed for $name", ({ results }) => {
        gameHistory.data = results;
        render(<GameWinScreen />);

        expect(modalStore.getState().modal).toBeNull();
    });
});
