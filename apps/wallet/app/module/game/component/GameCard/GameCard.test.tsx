import type { GameOutcome } from "@frak-labs/backend-elysia/domain/game/schemas";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { navigate, trackEvent, currentGame, gameHistory } = vi.hoisted(() => ({
    navigate: vi.fn(),
    trackEvent: vi.fn(),
    currentGame: { data: undefined as unknown },
    gameHistory: { data: undefined as unknown[] | undefined },
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    trackEvent,
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, values?: { count?: number; mission?: string }) =>
            values?.count === undefined ? key : `${key}:${values.count}`,
        i18n: { language: "fr-FR" },
    }),
}));
vi.mock("@/module/game/hook/useCurrentGame", () => ({
    useCurrentGame: () => currentGame,
}));
vi.mock("@/module/game/hook/useGameHistory", () => ({
    useGameHistory: () => gameHistory,
}));

import { gameSeenStore } from "@/module/game/stores/gameSeenStore";
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

const SOURCES = {
    join: 1,
    instagramCertified: 0,
    purchase: 0,
    referredPurchase: 0,
    referredSignup: 0,
    brandShare: 0,
};
const player = (
    instagram: "certified" | "declared" | "none",
    eligible: boolean,
    sources: Partial<typeof SOURCES> = {}
) => {
    const ticketsBySource = { ...SOURCES, ...sources };
    return {
        participating: true,
        tickets: Object.values(ticketsBySource).reduce((a, b) => a + b, 0),
        ticketsBySource,
        eligible,
        instagram,
    };
};
const outsider = {
    ...player("none", false),
    participating: false,
    tickets: 0,
};
const openGame = { ...game, endsAt: new Date(Date.now() + 3 * DAY) };
const endedDaysAgo = (days: number, outcome: GameOutcome = "won") =>
    gameResult({
        game: { endsAt: new Date(Date.now() - days * DAY) },
        outcome,
    });

describe("GameCard", () => {
    beforeEach(() => {
        navigate.mockClear();
        trackEvent.mockClear();
        gameSeenStore.setState({ seen: {} });
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

    it("puts a draw waiting on the user before the open game, with its deadline", () => {
        currentGame.data = { game, me: player("certified", true) };
        gameHistory.data = [
            {
                ...endedDaysAgo(1, "pending_verification"),
                verifyBy: new Date(Date.now() + DAY),
            },
        ];
        render(<GameCard />);

        expect(screen.getByText("game.card.drawn")).toBeInTheDocument();
        expect(screen.getByText("game.card.verifyBy")).toBeInTheDocument();
        expect(
            screen.getByText("game.result.badge.pendingVerification")
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button"));
        expect(navigate).toHaveBeenCalledWith({ to: "/profile/instagram" });
    });

    it("prefers the open game over the last result", () => {
        currentGame.data = { game, me: player("certified", true) };
        gameHistory.data = [endedDaysAgo(2)];
        render(<GameCard />);

        expect(screen.getByText("game.card.label")).toBeInTheDocument();
        expect(screen.queryByText("game.result.badge.won")).toBeNull();
    });

    it("sends a user who is not in the game to the code screen", () => {
        currentGame.data = { game, me: outsider };
        render(<GameCard />);

        expect(screen.getByText("?")).toBeInTheDocument();
        expect(screen.getByText("game.card.yourTicket")).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: /game.card.ariaLabel/ })
        );
        expect(navigate).toHaveBeenLastCalledWith({ to: "/game/join" });
        fireEvent.click(
            screen.getByRole("button", {
                name: "game.card.statusJoin game.card.statusJoinReward",
            })
        );
        expect(navigate).toHaveBeenLastCalledWith({ to: "/game/join" });
        expect(trackEvent.mock.calls).toEqual([
            ["game_card_clicked", { game_id: "d1", participating: false }],
        ]);
    });

    it("shows a description as the headline, without the amount caption", () => {
        currentGame.data = { game, me: player("certified", true) };
        render(<GameCard />);

        expect(screen.getByText("50 € à gagner")).toBeInTheDocument();
        expect(screen.queryByText("game.card.toWin")).toBeNull();
    });

    it("falls back to the formatted prize amount without a description", () => {
        currentGame.data = {
            game: { ...game, prizeDescription: null },
            me: outsider,
        };
        render(<GameCard />);

        expect(screen.getByText(/^50\s€$/)).toBeInTheDocument();
        expect(screen.getByText("game.card.toWin")).toBeInTheDocument();
    });

    it("sends a participant to the game page from anywhere but the status line", () => {
        currentGame.data = { game: openGame, me: player("certified", true) };
        render(<GameCard />);

        expect(screen.getByText("1")).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: /game.card.ariaLabel/ })
        );
        expect(navigate).toHaveBeenCalledWith({ to: "/game" });
        expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
            "game_card_clicked",
            { game_id: "d1", participating: true }
        );
    });

    it("leads a locked player to Instagram and tracks the tap", () => {
        currentGame.data = { game: openGame, me: player("none", false) };
        render(<GameCard />);

        fireEvent.click(
            screen.getByRole("button", {
                name: /game.page.missions.instagram.none.title/,
            })
        );
        expect(navigate).toHaveBeenCalledWith({ to: "/profile/instagram" });
        expect(trackEvent).toHaveBeenCalledWith("game_mission_clicked", {
            mission: "instagram",
            status: "gate",
            surface: "home_card",
            game_id: "d1",
        });
        expect(trackEvent).not.toHaveBeenCalledWith(
            "game_card_clicked",
            expect.anything()
        );
    });

    it("leads an eligible player to the next mission", () => {
        currentGame.data = {
            game: openGame,
            me: player("certified", true, { instagramCertified: 2 }),
        };
        render(<GameCard />);

        fireEvent.click(
            screen.getByRole("button", {
                name: /game.page.missions.friend.title/,
            })
        );
        expect(navigate).toHaveBeenCalledWith({
            to: "/profile/referral/share",
        });
        expect(trackEvent).toHaveBeenCalledWith("game_mission_clicked", {
            mission: "friend",
            status: "todo",
            surface: "home_card",
            game_id: "d1",
        });
    });

    it("sends a player with every mission done to the game page", () => {
        currentGame.data = {
            game: openGame,
            me: player("certified", true, {
                instagramCertified: 2,
                purchase: 3,
                referredSignup: 1,
            }),
        };
        render(<GameCard />);

        fireEvent.click(
            screen.getByRole("button", { name: "game.card.statusAllDone" })
        );
        expect(navigate).toHaveBeenCalledWith({ to: "/game" });
        expect(trackEvent).not.toHaveBeenCalled();
    });

    it("stamps the tickets gained since the stored visit, and only then", () => {
        currentGame.data = {
            game: openGame,
            me: player("certified", true, {
                instagramCertified: 2,
                purchase: 6,
            }),
        };
        const { unmount } = render(<GameCard />);
        expect(screen.queryByText("+4")).toBeNull();
        unmount();

        gameSeenStore.setState({
            seen: {
                d1: {
                    ticketsBySource: {
                        ...SOURCES,
                        instagramCertified: 2,
                        purchase: 3,
                    },
                    eligible: true,
                },
            },
        });
        render(<GameCard />);
        expect(screen.getByText("+3")).toBeInTheDocument();
        expect(gameSeenStore.getState().seen.d1?.ticketsBySource.purchase).toBe(
            3
        );
    });

    it("shows the countdown until the game ends", () => {
        currentGame.data = { game: openGame, me: player("certified", true) };
        render(<GameCard />);

        expect(
            screen.getByText("game.page.hero.countdownDays")
        ).toBeInTheDocument();
    });
});
