import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => navigate,
    Link: () => null,
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "fr-FR" },
    }),
}));

import type { GameResult } from "@/module/game/hook/useGameHistory";
import { modalStore } from "@/module/stores/modalStore";
import { GameResultSheet } from "./index";

const won = {
    game: {
        id: "g1",
        prizeAmount: 50,
        prizeDescription: null,
        startsAt: new Date("2026-10-01T10:00:00Z"),
        endsAt: new Date("2026-10-10T18:00:00Z"),
        sponsor: null,
    },
    outcome: "won",
    tickets: 4,
    ticketsBySource: {
        join: 1,
        purchase: 0,
        referredPurchase: 3,
        referredSignup: 0,
        brandShare: 0,
    },
    discarded: null,
    totalTickets: 80,
    participants: 12,
    confirmedAt: new Date("2026-10-10T19:00:00Z"),
} as unknown as GameResult;

describe("GameResultSheet", () => {
    beforeEach(() => {
        navigate.mockClear();
        modalStore.getState().dismissAll();
    });

    it("shows the outcome, the numbers and where the tickets came from", () => {
        render(<GameResultSheet result={won} onClose={vi.fn()} />);

        expect(screen.getByText("game.result.won.title")).toBeInTheDocument();
        expect(screen.getByText("80")).toBeInTheDocument();
        expect(screen.getByText("12")).toBeInTheDocument();
        expect(
            screen.getByText("game.result.sources.referredPurchase")
        ).toBeInTheDocument();
        expect(screen.queryByText("game.result.sources.purchase")).toBeNull();
    });

    it("closes every modal before leading a winner to their prize", () => {
        modalStore.getState().openModal({ id: "gameResult", result: won });
        render(<GameResultSheet result={won} onClose={vi.fn()} />);

        fireEvent.click(
            screen.getByRole("button", { name: /game.result.won.cta/ })
        );

        expect(modalStore.getState().modal).toBeNull();
        expect(navigate).toHaveBeenCalledWith({ to: "/history" });
    });

    it("closes from its close button", () => {
        const onClose = vi.fn();
        render(<GameResultSheet result={won} onClose={onClose} />);

        fireEvent.click(screen.getByRole("button", { name: "common.close" }));

        expect(onClose).toHaveBeenCalled();
    });
});
