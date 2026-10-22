import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

const { currentGame, tickets } = vi.hoisted(() => ({
    currentGame: {
        data: undefined as unknown,
        isError: false,
        refetch: vi.fn(),
    },
    tickets: { data: undefined as unknown, isError: false, refetch: vi.fn() },
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
vi.mock("@/module/common/component/Back", () => ({ Back: () => null }));
vi.mock("@/module/game/hook/useCurrentGame", () => ({
    useCurrentGame: () => currentGame,
}));
vi.mock("@/module/game/hook/useGameTickets", () => ({
    useGameTickets: () => tickets,
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
const joined = { game, me: { participating: true, eligible: false } };

describe("GamePage", () => {
    it("shows the tickets, prize and end date with the ways to earn more", () => {
        currentGame.data = joined;
        tickets.data = { tickets: 4, eligible: true };
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

    it("warns a non-follower that stored tickets do not count yet", () => {
        currentGame.data = joined;
        tickets.data = { tickets: 1, eligible: false };
        render(<GamePage />);

        expect(screen.getByText("game.page.locked")).toBeInTheDocument();
        expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("says when no game is open", () => {
        currentGame.data = { game: null, me: joined.me };
        tickets.data = undefined;
        render(<GamePage />);

        expect(screen.getByText("game.page.none.title")).toBeInTheDocument();
    });

    it("sends a user who has not joined to the code screen", () => {
        currentGame.data = {
            game,
            me: { participating: false, eligible: false },
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
