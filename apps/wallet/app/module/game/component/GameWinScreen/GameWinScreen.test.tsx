import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { navigate, gameHistory, trackEvent, confetti } = vi.hoisted(() => ({
    navigate: vi.fn(),
    gameHistory: { data: undefined as unknown[] | undefined },
    trackEvent: vi.fn(),
    confetti: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "fr-FR" },
    }),
}));
vi.mock("@frak-labs/wallet-shared", () => ({ trackEvent }));
vi.mock("@/module/game/hook/useGameHistory", () => ({
    useGameHistory: () => gameHistory,
}));
vi.mock("@/module/game/hook/useConfettiBurst", () => ({
    useConfettiBurst: confetti,
}));
vi.mock("@/module/native-glass/hook/useOverlayOpen", () => ({
    useCoverNativeChrome: vi.fn(),
}));

import { gameWinStore } from "@/module/game/stores/gameWinStore";
import { GameWinScreen } from "./index";

const DAY = 24 * 60 * 60 * 1000;
const result = (id: string, outcome: string, confirmedDaysAgo = 1) => ({
    game: { id, prizeAmount: 50, prizeDescription: null },
    outcome,
    confirmedAt: new Date(Date.now() - confirmedDaysAgo * DAY),
});

describe("GameWinScreen", () => {
    beforeEach(() => {
        navigate.mockClear();
        trackEvent.mockClear();
        confetti.mockClear();
        gameWinStore.setState({ celebrated: {} });
    });

    it("celebrates a fresh win with the prize and confetti", () => {
        gameHistory.data = [result("g1", "won")];
        render(<GameWinScreen />);

        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText(/^50\s€$/)).toBeInTheDocument();
        expect(screen.getByText("game.win.title")).toBeInTheDocument();
        expect(confetti).toHaveBeenCalled();
        expect(trackEvent).toHaveBeenCalledWith("game_win_screen_viewed", {
            game_id: "g1",
            prize_amount: 50,
        });
    });

    it("never shows the same win twice on this device", () => {
        gameHistory.data = [result("g1", "won")];
        const { rerender } = render(<GameWinScreen />);

        fireEvent.click(screen.getByText("game.win.close"));
        rerender(<GameWinScreen />);

        expect(screen.queryByRole("dialog")).toBeNull();
        expect(gameWinStore.getState().celebrated).toEqual({ g1: true });
        expect(trackEvent).toHaveBeenCalledWith("game_win_screen_closed", {
            game_id: "g1",
            action: "close",
        });
        expect(navigate).not.toHaveBeenCalled();
    });

    it("takes the winner to their history to see the prize", () => {
        gameHistory.data = [result("g1", "won")];
        render(<GameWinScreen />);

        fireEvent.click(screen.getByText("game.win.cta"));

        expect(navigate).toHaveBeenCalledWith({ to: "/history" });
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it.each([
        { name: "a lost game", results: [result("g1", "lost")] },
        { name: "a draw still running", results: [result("g1", "drawing")] },
        { name: "a win over a month old", results: [result("g1", "won", 31)] },
    ])("stays hidden for $name", ({ results }) => {
        gameHistory.data = results;
        render(<GameWinScreen />);

        expect(screen.queryByRole("dialog")).toBeNull();
    });
});
