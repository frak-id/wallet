import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { navigate, currentGame } = vi.hoisted(() => ({
    navigate: vi.fn(),
    currentGame: { data: undefined as unknown },
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

import { GameCard } from "./index";

const game = {
    id: "d1",
    prizeAmount: 50,
    prizeDescription: "50 € à gagner",
    startsAt: new Date(),
    endsAt: new Date(),
    sponsor: null,
};

describe("GameCard", () => {
    beforeEach(() => navigate.mockClear());

    it("renders nothing when no game is open", () => {
        currentGame.data = { game: null, me: { participating: false } };
        const { container } = render(<GameCard />);
        expect(container.firstChild).toBeNull();
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
