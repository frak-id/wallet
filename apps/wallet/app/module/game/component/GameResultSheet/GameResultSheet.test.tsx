import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { navigate, openExternalUrl } = vi.hoisted(() => ({
    navigate: vi.fn(),
    openExternalUrl: vi.fn(),
}));

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
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@frak-labs/wallet-shared")>()),
    openExternalUrl,
}));

import { modalStore } from "@/module/stores/modalStore";
import { gameResult } from "@/tests/gameFixtures";
import { GameResultSheet } from "./index";

const won = gameResult({
    outcome: "won",
    tickets: 4,
    drawTickets: 4,
    ticketsBySource: {
        join: 1,
        purchase: 0,
        referredPurchase: 3,
        referredSignup: 0,
        brandShare: 0,
    },
    totalTickets: 80,
    participants: 12,
    confirmedAt: new Date("2026-10-10T19:00:00Z"),
});

describe("GameResultSheet", () => {
    beforeEach(() => {
        navigate.mockClear();
        openExternalUrl.mockClear();
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

    it("offers the curious a way to the public draw record, with their id", () => {
        render(
            <GameResultSheet
                result={{ ...won, pid: "ab12cd34" }}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByText("game.result.verify.pid")).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: /game.result.verify.link/ })
        );

        expect(openExternalUrl).toHaveBeenCalledWith(
            expect.stringMatching(/\/common\/game\/g1\/draw$/)
        );
    });

    it("hides the draw check while the player is not in the public list", () => {
        render(<GameResultSheet result={won} onClose={vi.fn()} />);

        expect(
            screen.queryByRole("button", { name: /game.result.verify.link/ })
        ).toBeNull();
    });
});
