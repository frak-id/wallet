import type { GameOutcome } from "@frak-labs/backend-elysia/domain/game/schemas";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { navigate, currentGame, gameHistory } = vi.hoisted(() => ({
    navigate: vi.fn(),
    currentGame: { data: undefined as unknown },
    gameHistory: { data: undefined as unknown[] | undefined },
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "fr-FR" },
    }),
}));
vi.mock("@/module/game/hook/useCurrentGame", () => ({
    useCurrentGame: () => currentGame,
}));
vi.mock("@/module/game/hook/useGameHistory", () => ({
    useGameHistory: () => gameHistory,
}));

import { gameResult } from "@/tests/gameFixtures";
import { GameCard } from "./index";

const game = {
    id: "d1",
    prizeAmount: 50,
    prizeDescription: "50 € à gagner",
    startsAt: new Date(),
    endsAt: new Date(),
    sponsor: null,
};

const DAY = 24 * 60 * 60 * 1000;
const endedDaysAgo = (days: number, outcome: GameOutcome = "won") =>
    gameResult({
        game: { endsAt: new Date(Date.now() - days * DAY) },
        outcome,
    });

describe("GameCard", () => {
    beforeEach(() => {
        navigate.mockClear();
        gameHistory.data = [];
    });

    it("renders nothing when no game is open and none was played", () => {
        currentGame.data = { game: null, me: { participating: false } };
        const { container } = render(<GameCard />);
        expect(container.firstChild).toBeNull();
    });

    it("shows how the last game went when it ended recently", () => {
        currentGame.data = { game: null, me: { participating: false } };
        gameHistory.data = [endedDaysAgo(2), endedDaysAgo(40, "lost")];
        render(<GameCard />);

        expect(screen.getByText("game.card.ended")).toBeInTheDocument();
        expect(screen.getByText("game.result.badge.won")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button"));
        expect(navigate).toHaveBeenCalledWith({ to: "/game" });
    });

    it("drops the last result from home after two weeks", () => {
        currentGame.data = { game: null, me: { participating: false } };
        gameHistory.data = [endedDaysAgo(15)];
        const { container } = render(<GameCard />);
        expect(container.firstChild).toBeNull();
    });

    it("prefers the open game over the last result", () => {
        currentGame.data = { game, me: { participating: true } };
        gameHistory.data = [endedDaysAgo(2)];
        render(<GameCard />);

        expect(screen.getByText("game.card.title")).toBeInTheDocument();
        expect(screen.queryByText("game.result.badge.won")).toBeNull();
    });

    it("sends a user who is not in the game to the code screen", () => {
        currentGame.data = { game, me: { participating: false } };
        render(<GameCard />);

        expect(screen.getByText("50 € à gagner")).toBeInTheDocument();
        expect(
            screen.getByText("game.card.notParticipating")
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button"));
        expect(navigate).toHaveBeenCalledWith({ to: "/game/join" });
    });

    it("falls back to the formatted prize amount without a description", () => {
        currentGame.data = {
            game: { ...game, prizeDescription: null },
            me: { participating: false },
        };
        render(<GameCard />);

        expect(screen.getByText(/^50\s€$/)).toBeInTheDocument();
    });

    it("sends a participant to the game page", () => {
        currentGame.data = { game, me: { participating: true } };
        render(<GameCard />);

        expect(screen.getByText("game.card.participating")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button"));
        expect(navigate).toHaveBeenCalledWith({ to: "/game" });
    });
});
