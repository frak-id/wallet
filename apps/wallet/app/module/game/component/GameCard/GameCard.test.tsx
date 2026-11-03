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

    it.each([
        ["won", "game.result.won.title"],
        ["lost", "game.result.lost.title"],
        ["drawing", "game.result.drawing.title"],
        ["no_winner", "game.result.noWinner.title"],
    ] as const)(
        "shows a game that ended recently as a %s ticket",
        (outcome, title) => {
            currentGame.data = { game: null, me: { participating: false } };
            gameHistory.data = [
                endedDaysAgo(2, outcome),
                endedDaysAgo(40, "lost"),
            ];
            const { container } = render(<GameCard />);

            expect(screen.getByText(title)).toBeInTheDocument();
            expect(screen.getByText("game.history.gameOf")).toBeInTheDocument();
            expect(
                screen.getByText("game.card.statusResult")
            ).toBeInTheDocument();
            expect(container.querySelectorAll("[role=button]")).toHaveLength(0);
            const buttons = screen.getAllByRole("button");
            expect(buttons).toHaveLength(1);
            expect(buttons[0]).toHaveAccessibleName("game.card.endedAriaLabel");
            fireEvent.click(buttons[0]);
            expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: "/game" });
            expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
                "game_card_clicked",
                {
                    game_id: "g1",
                    participating: true,
                    state: "ended",
                    target: "game",
                }
            );
        }
    );

    it("puts the prize on the stub of a won game, the tickets on the others", () => {
        currentGame.data = { game: null, me: { participating: false } };
        gameHistory.data = [endedDaysAgo(2, "won")];
        const { unmount } = render(<GameCard />);
        expect(screen.getByText(/^50\s€$/)).toBeInTheDocument();
        unmount();

        gameHistory.data = [endedDaysAgo(2, "lost")];
        render(<GameCard />);
        expect(screen.getByText("7")).toBeInTheDocument();
        expect(screen.getByText("game.card.ticket:7")).toBeInTheDocument();
        expect(screen.queryByText(/^50\s€$/)).toBeNull();
    });

    it("drops the last result from home after two weeks", () => {
        currentGame.data = { game: null, me: { participating: false } };
        gameHistory.data = [endedDaysAgo(15)];
        const { container } = render(<GameCard />);
        expect(container.firstChild).toBeNull();
    });

    describe("with a draw waiting on the user", () => {
        const drawn = (verifyBy: Date | null) => {
            currentGame.data = { game, me: player("certified", true) };
            gameHistory.data = [
                {
                    ...endedDaysAgo(1, "pending_verification"),
                    verifyBy,
                },
            ];
            return render(<GameCard />);
        };

        it("comes before the open game, as a ticket with the prize on the stub", () => {
            const { container } = drawn(new Date(Date.now() + DAY));

            expect(screen.getByText("game.card.drawn")).toBeInTheDocument();
            expect(screen.getByText(/^50\s€$/)).toBeInTheDocument();
            expect(screen.queryByText("game.card.label:")).toBeNull();
            expect(container.querySelectorAll("[role=button]")).toHaveLength(0);
            expect(screen.getAllByRole("button")).toHaveLength(1);
        });

        it("opens the game page, the Instagram line included", () => {
            drawn(new Date(Date.now() + DAY));

            expect(
                screen.getByText("game.result.pendingVerification.cta")
            ).toBeInTheDocument();
            fireEvent.click(
                screen.getByRole("button", { name: "game.card.drawnAriaLabel" })
            );
            expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: "/game" });
            expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
                "game_card_clicked",
                {
                    game_id: "g1",
                    participating: true,
                    state: "drawn",
                    target: "game",
                }
            );
        });

        it("counts the time left and gives the deadline while it is open", () => {
            drawn(new Date(Date.now() + 21 * 3_600_000 + 60_000));

            expect(
                screen.getByText("game.result.hero.timeLeftHours")
            ).toBeInTheDocument();
            expect(
                screen.getByText("game.result.hero.deadline")
            ).toBeInTheDocument();
        });

        it.each([
            ["has no deadline", null],
            ["has passed", new Date(Date.now() - 60_000)],
        ])(
            "drops the pill and the date when the deadline %s",
            (_, verifyBy) => {
                drawn(verifyBy);

                expect(
                    screen.queryByText(/game.result.hero.timeLeft/)
                ).toBeNull();
                expect(
                    screen.queryByText("game.result.hero.deadline")
                ).toBeNull();
                expect(
                    screen.getByText("game.result.pendingVerification.cta")
                ).toBeInTheDocument();
            }
        );

        it("leaves the deadline line out without a date", () => {
            drawn(null);

            expect(screen.queryByText("game.result.hero.deadline")).toBeNull();
        });
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
        expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: "/game/join" });
        expect(screen.getByText("game.card.statusJoin")).toBeInTheDocument();
        expect(trackEvent.mock.calls).toEqual([
            [
                "game_card_clicked",
                {
                    game_id: "d1",
                    participating: false,
                    state: "open",
                    target: "join",
                },
            ],
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

    it("sends a participant to the game page", () => {
        currentGame.data = { game: openGame, me: player("certified", true) };
        render(<GameCard />);

        expect(screen.getByText("1")).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: /game.card.ariaLabel/ })
        );
        expect(navigate).toHaveBeenCalledWith({ to: "/game" });
        expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
            "game_card_clicked",
            {
                game_id: "d1",
                participating: true,
                state: "open",
                target: "game",
            }
        );
    });

    it.each([
        [
            "a locked player",
            player("none", false),
            /game.page.missions.instagram.none.title/,
        ],
        [
            "an eligible player",
            player("certified", true, { instagramCertified: 2 }),
            /game.page.missions.friend.title/,
        ],
        [
            "a player with every mission done",
            player("certified", true, {
                instagramCertified: 2,
                purchase: 3,
                referredSignup: 1,
            }),
            /game.card.statusAllDone/,
        ],
    ])(
        "names the next step for %s without leaving the card's single tap",
        (_, me, status) => {
            currentGame.data = { game: openGame, me };
            render(<GameCard />);

            expect(screen.getByText(status)).toBeInTheDocument();
            expect(screen.getAllByRole("button")).toHaveLength(1);
            fireEvent.click(screen.getByText(status));
            expect(navigate).not.toHaveBeenCalled();
            expect(trackEvent).not.toHaveBeenCalledWith(
                "game_mission_clicked",
                expect.anything()
            );
        }
    );

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
