import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { currentGame, gameConfig, gameHistory, navigate, trackEvent } =
    vi.hoisted(() => ({
        navigate: vi.fn(),
        trackEvent: vi.fn(),
        gameConfig: { instagramLink: false },
        currentGame: {
            data: undefined as unknown,
            isError: false,
            refetch: vi.fn(),
        },
        gameHistory: { data: [] as unknown[], isLoading: false },
    }));

vi.mock("@tanstack/react-router", () => ({
    Navigate: ({ to }: { to: string }) => <p>navigate:{to}</p>,
    useNavigate: () => navigate,
    Link: ({ to, children }: { to: string; children: ReactElement }) => (
        <a href={to}>{children}</a>
    ),
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, values?: { count?: number }) =>
            values?.count === undefined ? key : `${key}:${values.count}`,
        i18n: { language: "fr-FR" },
    }),
    Trans: ({ i18nKey }: { i18nKey: string }) => <>{i18nKey}</>,
}));
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    trackEvent,
}));
vi.mock("@/module/common/component/Back", () => ({ Back: () => null }));
vi.mock("@/module/game/config", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    frakGame: gameConfig,
}));
vi.mock("@/module/game/hook/useCurrentGame", () => ({
    useCurrentGame: () => currentGame,
}));
vi.mock("@/module/game/hook/useGameHistory", () => ({
    useGameHistory: () => gameHistory,
}));

import { modalStore } from "@/module/stores/modalStore";
import { GamePage } from "./index";

const NO_GAME = {
    game: null,
    me: { participating: false, tickets: 0, eligible: false },
};
const result = (id: string, outcome: string, overrides: object = {}) => ({
    game: {
        id,
        prizeAmount: 50,
        prizeDescription: null,
        startsAt: new Date("2026-10-01T10:00:00Z"),
        endsAt: new Date("2026-10-10T18:00:00Z"),
        sponsor: null,
    },
    outcome,
    tickets: 7,
    ticketsBySource: {
        join: 1,
        purchase: 6,
        referredPurchase: 0,
        referredSignup: 0,
        brandShare: 0,
    },
    discarded: null,
    totalTickets: 120,
    participants: 30,
    confirmedAt: null,
    ...overrides,
});

const game = {
    id: "d1",
    prizeAmount: 50,
    prizeDescription: "50 € à gagner",
    startsAt: new Date("2026-10-20T10:00:00Z"),
    endsAt: new Date("2026-10-30T18:00:00Z"),
    sponsor: null,
};
const player = (tickets: number, eligible: boolean) => ({
    game,
    me: {
        participating: true,
        tickets,
        ticketsBySource: {
            join: 1,
            purchase: tickets - 1,
            referredPurchase: 0,
            referredSignup: 0,
            brandShare: 0,
        },
        eligible,
    },
});

describe("GamePage", () => {
    beforeEach(() => {
        gameHistory.data = [];
        gameHistory.isLoading = false;
        navigate.mockClear();
        modalStore.getState().dismissAll();
    });

    it("tracks the page view once with the tickets by source", () => {
        trackEvent.mockReset();
        currentGame.data = player(4, true);
        const { rerender } = render(<GamePage />);
        rerender(<GamePage />);

        expect(trackEvent).toHaveBeenCalledTimes(1);
        expect(trackEvent).toHaveBeenCalledWith("game_page_viewed", {
            tickets: 4,
            eligible: true,
            tickets_join: 1,
            tickets_purchase: 3,
            tickets_referred_purchase: 0,
            tickets_referred_signup: 0,
            tickets_brand_share: 0,
        });
    });

    it("shows the tickets, prize and end date with the ways to earn more", () => {
        currentGame.data = player(4, true);
        render(<GamePage />);

        expect(screen.getByText("4")).toBeInTheDocument();
        expect(screen.getByText("game.page.tickets:4")).toBeInTheDocument();
        expect(screen.getByText("50 € à gagner")).toBeInTheDocument();
        expect(
            screen.getByText("onboarding.game.reward.game.endsAt")
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: /game.page.share/ })
        ).toHaveAttribute("href", "/profile/referral/share");
        expect(
            screen.getByRole("link", { name: /game.page.buy/ })
        ).toHaveAttribute("href", "/explorer");
        expect(screen.queryByText("game.page.locked")).toBeNull();
    });

    it("confirms to an eligible player that their tickets count", () => {
        currentGame.data = player(4, true);
        render(<GamePage />);

        expect(
            screen.getByText("game.instagram.linked.counting")
        ).toBeInTheDocument();
    });

    it("warns a non-follower that stored tickets do not count yet", () => {
        currentGame.data = player(1, false);
        render(<GamePage />);

        expect(screen.getByText("game.page.locked")).toBeInTheDocument();
        expect(screen.getByText("1")).toBeInTheDocument();
        expect(screen.queryByText("game.instagram.linked.counting")).toBeNull();
    });

    it("links a non-follower to the Instagram linking screen once linking is on", () => {
        gameConfig.instagramLink = true;
        currentGame.data = player(1, false);
        render(<GamePage />);
        gameConfig.instagramLink = false;

        expect(screen.getByText("game.page.lockedLink")).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: /game.page.linkCta/ })
        ).toHaveAttribute("href", "/game/instagram");
    });

    it("says when no game is open and none was played", () => {
        currentGame.data = NO_GAME;
        render(<GamePage />);

        expect(screen.getByText("game.page.none.title")).toBeInTheDocument();
    });

    it("waits for the past games before choosing what to show", () => {
        currentGame.data = NO_GAME;
        gameHistory.isLoading = true;
        render(<GamePage />);

        expect(screen.queryByText("game.page.none.title")).toBeNull();
    });

    it("shows the last result in full once no game is open, the earlier ones below", () => {
        trackEvent.mockReset();
        currentGame.data = NO_GAME;
        gameHistory.data = [
            result("latest", "lost"),
            result("earlier", "won", { totalTickets: null, tickets: 2 }),
        ];
        render(<GamePage />);

        expect(screen.getByText("game.result.lost.title")).toBeInTheDocument();
        expect(screen.getByText("120")).toBeInTheDocument();
        expect(screen.getByText("30")).toBeInTheDocument();
        expect(screen.getByText("game.history.title")).toBeInTheDocument();
        expect(screen.getByText("game.history.tickets:2")).toBeInTheDocument();
        expect(screen.getByText("game.result.badge.won")).toBeInTheDocument();
        expect(screen.queryByText("game.page.none.title")).toBeNull();
        expect(trackEvent).toHaveBeenCalledWith("game_result_viewed", {
            game_id: "latest",
            outcome: "lost",
        });
    });

    it("points a winner to the prize in their history", () => {
        currentGame.data = NO_GAME;
        gameHistory.data = [result("latest", "won")];
        render(<GamePage />);

        expect(screen.getByText("game.result.won.title")).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: /game.result.won.cta/ })
        ).toHaveAttribute("href", "/history");
    });

    it("tells a non-follower why their tickets did not count", () => {
        currentGame.data = NO_GAME;
        gameHistory.data = [
            result("latest", "lost", { discarded: "not_following" }),
        ];
        render(<GamePage />);

        expect(screen.getByText("game.result.discarded")).toBeInTheDocument();
    });

    it("breaks the user's tickets down by where they came from", () => {
        currentGame.data = NO_GAME;
        gameHistory.data = [result("latest", "lost")];
        render(<GamePage />);

        expect(
            screen.getByText("game.result.sources.title")
        ).toBeInTheDocument();
        expect(
            screen.getByText("game.result.sources.join")
        ).toBeInTheDocument();
        expect(
            screen.getByText("game.result.sources.purchase")
        ).toBeInTheDocument();
        expect(screen.queryByText("game.result.sources.brandShare")).toBeNull();
    });

    it("counts no tickets for a past game whose tickets were thrown out", () => {
        currentGame.data = NO_GAME;
        gameHistory.data = [
            result("latest", "lost"),
            result("earlier", "no_winner", {
                discarded: "not_following",
                totalTickets: 0,
            }),
        ];
        render(<GamePage />);

        expect(screen.getByText("game.history.notCounted")).toBeInTheDocument();
        expect(screen.queryByText("game.history.ticketsOf:7")).toBeNull();
    });

    it("opens a past game's result from its row", () => {
        currentGame.data = player(4, true);
        const earlier = result("earlier", "lost");
        gameHistory.data = [earlier];
        render(<GamePage />);

        fireEvent.click(
            screen.getByRole("button", { name: /game.history.gameOf/ })
        );

        expect(modalStore.getState().modal).toEqual({
            id: "gameResult",
            result: earlier,
        });
    });

    it("lists past games under the open one", () => {
        currentGame.data = player(4, true);
        gameHistory.data = [result("earlier", "lost")];
        render(<GamePage />);

        expect(screen.getByText("game.page.tickets:4")).toBeInTheDocument();
        expect(
            screen.getByText("game.history.ticketsOf:7")
        ).toBeInTheDocument();
        expect(screen.queryByText("game.result.lost.title")).toBeNull();
    });

    it("keeps a past player who has not joined the open game on the page", () => {
        currentGame.data = {
            game,
            me: { participating: false, tickets: 0, eligible: false },
        };
        gameHistory.data = [result("earlier", "lost")];
        render(<GamePage />);

        expect(screen.queryByText("navigate:/game/join")).toBeNull();
        expect(
            screen.getByText("game.card.notParticipating")
        ).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: /game.card.title/ })
        );
        expect(navigate).toHaveBeenCalledWith({ to: "/game/join" });
    });

    it("sends a user who has not joined to the code screen", () => {
        currentGame.data = {
            game,
            me: { participating: false, tickets: 0, eligible: false },
        };
        render(<GamePage />);

        expect(screen.getByText("navigate:/game/join")).toBeInTheDocument();
    });

    it("offers a retry when the game fails to load", () => {
        currentGame.data = undefined;
        currentGame.isError = true;
        render(<GamePage />);

        expect(screen.getByText("game.page.error")).toBeInTheDocument();
        currentGame.isError = false;
    });
});
