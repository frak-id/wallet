import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

const { currentGame, gameConfig, trackEvent } = vi.hoisted(() => ({
    trackEvent: vi.fn(),
    gameConfig: { instagramLink: false },
    currentGame: {
        data: undefined as unknown,
        isError: false,
        refetch: vi.fn(),
    },
}));

vi.mock("@tanstack/react-router", () => ({
    Navigate: ({ to }: { to: string }) => <p>navigate:{to}</p>,
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

import { GamePage } from "./index";

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

    it("says when no game is open", () => {
        currentGame.data = {
            game: null,
            me: { participating: false, tickets: 0, eligible: false },
        };
        render(<GamePage />);

        expect(screen.getByText("game.page.none.title")).toBeInTheDocument();
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
