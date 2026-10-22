import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { navigate, currentDrop } = vi.hoisted(() => ({
    navigate: vi.fn(),
    currentDrop: { data: undefined as unknown },
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/module/game/hook/useCurrentDrop", () => ({
    useCurrentDrop: () => currentDrop,
}));

import { GameCard } from "./index";

const drop = {
    id: "d1",
    prizeDescription: "50 € à gagner",
    reward: 1,
    startsAt: new Date(),
    endsAt: new Date(),
    sponsor: null,
};

describe("GameCard", () => {
    beforeEach(() => navigate.mockClear());

    it("renders nothing when no game is open", () => {
        currentDrop.data = null;
        const { container } = render(<GameCard />);
        expect(container.firstChild).toBeNull();
    });

    it("sends a user who is not in the game to the code screen", () => {
        currentDrop.data = { ...drop, joined: false };
        render(<GameCard />);

        expect(screen.getByText("50 € à gagner")).toBeInTheDocument();
        expect(
            screen.getByText("game.card.notParticipating")
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button"));
        expect(navigate).toHaveBeenCalledWith({ to: "/game/join" });
    });

    it("shows a participant as in the game", () => {
        currentDrop.data = { ...drop, joined: true };
        render(<GameCard />);

        expect(screen.getByText("game.card.participating")).toBeInTheDocument();
        expect(screen.queryByRole("button")).toBeNull();
    });
});
