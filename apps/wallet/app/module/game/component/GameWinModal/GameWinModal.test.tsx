import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { navigate, trackEvent, confetti } = vi.hoisted(() => ({
    navigate: vi.fn(),
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
vi.mock("@/module/game/hook/useConfettiBurst", () => ({
    useConfettiBurst: confetti,
}));

import { modalStore } from "@/module/stores/modalStore";
import { gameResult } from "@/tests/gameFixtures";
import { GameWinModal } from "./index";

const win = gameResult({ outcome: "won" });

describe("GameWinModal", () => {
    beforeEach(() => {
        navigate.mockClear();
        trackEvent.mockClear();
        confetti.mockClear();
        modalStore.setState({
            modal: { id: "gameWin", result: win },
            stack: [],
        });
    });

    it("celebrates the prize with confetti", () => {
        render(<GameWinModal result={win} onClose={vi.fn()} />);

        expect(screen.getByText(/^50\s€$/)).toBeInTheDocument();
        expect(screen.getByText("game.win.title")).toBeInTheDocument();
        expect(confetti).toHaveBeenCalled();
    });

    it("closes through the overlay", () => {
        const onClose = vi.fn();
        render(<GameWinModal result={win} onClose={onClose} />);

        fireEvent.click(screen.getByText("game.win.close"));

        expect(onClose).toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
        expect(trackEvent).toHaveBeenCalledWith("game_win_screen_closed", {
            game_id: "g1",
            action: "close",
        });
    });

    it("takes the winner to their history to see the prize", () => {
        render(<GameWinModal result={win} onClose={vi.fn()} />);

        fireEvent.click(screen.getByText("game.win.cta"));

        expect(modalStore.getState().modal).toBeNull();
        expect(navigate).toHaveBeenCalledWith({ to: "/history" });
        expect(trackEvent).toHaveBeenCalledWith("game_win_screen_closed", {
            game_id: "g1",
            action: "history",
        });
    });
});
