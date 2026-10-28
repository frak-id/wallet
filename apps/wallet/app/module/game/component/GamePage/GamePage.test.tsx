import type { GameOutcome } from "@frak-labs/backend-elysia/domain/game/schemas";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { currentGame, gameHistory, navigate, trackEvent } = vi.hoisted(() => ({
    navigate: vi.fn(),
    trackEvent: vi.fn(),
    currentGame: {
        data: undefined as unknown,
        isError: false,
        refetch: vi.fn(),
    },
    gameHistory: {
        data: [] as unknown[],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
    },
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
vi.mock("@/module/game/hook/useCurrentGame", () => ({
    useCurrentGame: () => currentGame,
}));
vi.mock("@/module/game/hook/useGameHistory", () => ({
    useGameHistory: () => gameHistory,
}));

import { modalStore } from "@/module/stores/modalStore";
import { gameResult } from "@/tests/gameFixtures";
import { GamePage } from "./index";

const NO_GAME = {
    game: null,
    me: {
        participating: false,
        tickets: 0,
        eligible: false,
        instagram: "none",
    },
};
const result = (
    id: string,
    outcome: GameOutcome,
    overrides: Parameters<typeof gameResult>[0] = {}
) => gameResult({ game: { id }, outcome, ...overrides });

const game = {
    id: "d1",
    prizeAmount: 50,
    prizeDescription: "50 € à gagner",
    startsAt: new Date("2026-10-20T10:00:00Z"),
    endsAt: new Date("2026-10-30T18:00:00Z"),
    sponsor: null,
};
const player = (
    tickets: number,
    eligible: boolean,
    instagram: "certified" | "declared" | "none" = eligible
        ? "certified"
        : "none"
) => ({
    game,
    me: {
        participating: true,
        tickets,
        ticketsBySource: {
            join: 1,
            instagramCertified: 0,
            purchase: tickets - 1,
            referredPurchase: 0,
            referredSignup: 0,
            brandShare: 0,
        },
        eligible,
        instagram,
    },
});

describe("GamePage", () => {
    beforeEach(() => {
        gameHistory.data = [];
        gameHistory.isLoading = false;
        gameHistory.isError = false;
        currentGame.isError = false;
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
            instagram: "certified",
            tickets_join: 1,
            tickets_instagram_certified: 0,
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
        expect(screen.queryByText("game.page.lockedNone")).toBeNull();
    });

    it("confirms to a certified follower that their tickets count, with no +2 to earn", () => {
        currentGame.data = player(4, true);
        render(<GamePage />);

        expect(screen.getByText("game.page.certified")).toBeInTheDocument();
        expect(
            screen.queryByRole("link", { name: /game.page.certifyCta/ })
        ).toBeNull();
    });

    it("locks the tickets of a player with no Instagram, with what each level would count", () => {
        currentGame.data = player(2, false);
        render(<GamePage />);

        expect(screen.getByText("game.page.lockedNone")).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
        expect(screen.queryByText("game.page.certified")).toBeNull();
        const certify = screen.getByRole("link", {
            name: /game.page.certifyCta/,
        });
        expect(certify).toHaveAttribute("href", "/profile/instagram");
        expect(certify).toHaveTextContent("game.page.counted:4");
        const declare = screen.getByRole("link", {
            name: /game.page.declareCta/,
        });
        expect(declare).toHaveAttribute("href", "/profile/instagram");
        expect(declare).toHaveTextContent("game.page.counted:2");
        expect(screen.queryByText("game.page.gain:2")).toBeNull();
    });

    it("tells a declared player their tickets count and offers +2 to certify", () => {
        currentGame.data = player(1, true, "declared");
        render(<GamePage />);

        expect(screen.getByText("game.page.declared")).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: /game.page.certifyCta/ })
        ).toHaveAttribute("href", "/profile/instagram");
        expect(screen.getByText("game.page.gain:2")).toBeInTheDocument();
    });

    it("warns a certified non-follower that their tickets do not count", () => {
        currentGame.data = player(3, false, "certified");
        render(<GamePage />);

        expect(
            screen.getByText("game.page.lockedNotFollowing")
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: /game.page.activateCta/ })
        ).toHaveAttribute("href", "/profile/instagram");
    });

    it("puts a draw waiting on the player above the open game", () => {
        currentGame.data = player(4, true);
        gameHistory.data = [
            result("drawn", "pending_verification", {
                verifyBy: new Date("2026-11-02T10:00:00Z"),
            }),
            result("earlier", "lost"),
        ];
        render(<GamePage />);

        expect(
            screen.getByText("game.result.pendingVerification.title")
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", {
                name: /game.result.pendingVerification.cta/,
            })
        ).toHaveAttribute("href", "/profile/instagram");
        expect(
            screen.getAllByRole("button", { name: /game.history.gameOf/ })
        ).toHaveLength(1);
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
            result("earlier", "won", {
                totalTickets: null,
                drawTickets: 2,
            }),
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

    it("tells a player with no Instagram why their tickets did not count", () => {
        currentGame.data = NO_GAME;
        gameHistory.data = [
            result("latest", "lost", { discarded: "not_linked" }),
        ];
        render(<GamePage />);

        expect(
            screen.getByText("game.result.discardedNotLinked")
        ).toBeInTheDocument();
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
                drawTickets: 0,
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
            me: {
                participating: false,
                tickets: 0,
                eligible: false,
                instagram: "none",
            },
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
            me: {
                participating: false,
                tickets: 0,
                eligible: false,
                instagram: "none",
            },
        };
        render(<GamePage />);

        expect(screen.getByText("navigate:/game/join")).toBeInTheDocument();
    });

    it("offers a retry when the game fails to load", () => {
        currentGame.data = undefined;
        currentGame.isError = true;
        render(<GamePage />);

        expect(screen.getByText("game.page.error")).toBeInTheDocument();
    });

    it("keeps showing the cached game when a refetch fails", () => {
        currentGame.data = player(4, true);
        currentGame.isError = true;
        render(<GamePage />);

        expect(screen.getByText("game.page.tickets:4")).toBeInTheDocument();
        expect(screen.queryByText("game.page.error")).toBeNull();
    });

    it("offers a retry of both lists when past games fail to load", () => {
        currentGame.refetch.mockClear();
        gameHistory.refetch.mockClear();
        currentGame.data = NO_GAME;
        gameHistory.isError = true;
        render(<GamePage />);

        expect(screen.queryByText("game.page.none.title")).toBeNull();
        fireEvent.click(
            screen.getByRole("button", { name: "game.page.retry" })
        );
        expect(currentGame.refetch).toHaveBeenCalled();
        expect(gameHistory.refetch).toHaveBeenCalled();
    });
});
