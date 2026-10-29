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
        refetch: vi.fn(() => Promise.resolve()),
    },
    gameHistory: {
        data: [] as unknown[],
        isLoading: false,
        isError: false,
        refetch: vi.fn(() => Promise.resolve()),
    },
}));

vi.mock("@tanstack/react-router", () => ({
    Navigate: ({ to }: { to: string }) => <p>navigate:{to}</p>,
    useNavigate: () => navigate,
    Link: ({
        to,
        children,
        onClick,
    }: {
        to: string;
        children: ReactElement;
        onClick?: () => void;
    }) => (
        <a href={to} onClick={onClick}>
            {children}
        </a>
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
vi.mock("@/module/instagram/hook/useInstagramLink", () => ({
    useRefreshInstagramFollow: () => undefined,
}));
vi.mock("@/module/game/hook/useCurrentGame", () => ({
    useCurrentGame: () => currentGame,
}));
vi.mock("@/module/game/hook/useGameHistory", () => ({
    useGameHistory: () => gameHistory,
}));

import { gameSeenStore } from "@/module/game/stores/gameSeenStore";
import { FRAK_INSTAGRAM_URL } from "@/module/instagram/config";
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
        gameSeenStore.setState({ seen: {} });
        modalStore.getState().dismissAll();
    });

    it("reloads the history, then the game, a little after it ends", async () => {
        vi.useFakeTimers();
        try {
            let historyLoaded = () => {};
            currentGame.refetch.mockClear();
            gameHistory.refetch.mockClear();
            gameHistory.refetch.mockImplementationOnce(
                () =>
                    new Promise<void>((resolve) => {
                        historyLoaded = resolve;
                    })
            );
            currentGame.data = {
                ...player(4, true),
                game: { ...game, endsAt: new Date(Date.now() + 60_000) },
            };
            render(<GamePage />);
            expect(
                screen.getByText(/game.page.hero.countdown/)
            ).toBeInTheDocument();

            await vi.advanceTimersByTimeAsync(60_000);
            expect(gameHistory.refetch).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(5_000);
            expect(gameHistory.refetch).toHaveBeenCalledTimes(1);
            expect(currentGame.refetch).not.toHaveBeenCalled();

            historyLoaded();
            await vi.advanceTimersByTimeAsync(0);
            expect(currentGame.refetch).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it("hides the countdown once the game has ended", () => {
        currentGame.data = {
            ...player(4, true),
            game: { ...game, endsAt: new Date(Date.now() - 1_000) },
        };
        render(<GamePage />);

        expect(screen.queryByText(/game.page.hero.countdown/)).toBeNull();
        expect(
            screen.getByText("onboarding.game.reward.game.endsAt")
        ).toBeInTheDocument();
    });

    it("tracks the page view once with the tickets by source", () => {
        trackEvent.mockReset();
        currentGame.data = player(4, true);
        const { rerender } = render(<GamePage />);
        rerender(<GamePage />);

        expect(trackEvent).toHaveBeenCalledTimes(1);
        expect(trackEvent).toHaveBeenCalledWith("game_page_viewed", {
            game_id: "d1",
            tickets: 4,
            eligible: true,
            instagram: "certified",
            missions_done: 3,
            tickets_join: 1,
            tickets_instagram_certified: 0,
            tickets_purchase: 3,
            tickets_referred_purchase: 0,
            tickets_referred_signup: 0,
            tickets_brand_share: 0,
        });
    });

    it("shows the tickets, prize and end date in the hero", () => {
        currentGame.data = player(4, true);
        render(<GamePage />);

        expect(screen.getByText("game.page.hero.drawn:4")).toBeInTheDocument();
        expect(screen.getByText("50 € à gagner")).toBeInTheDocument();
        expect(
            screen.getByText("onboarding.game.reward.game.endsAt")
        ).toBeInTheDocument();
        expect(screen.queryByText("game.page.hero.pending:4")).toBeNull();
    });

    it("lists the missions with how many are done, friend and purchase leading to where to earn", () => {
        currentGame.data = player(4, true);
        render(<GamePage />);

        expect(
            screen.getByText("game.page.missions.progress")
        ).toBeInTheDocument();
        expect(screen.getByRole("progressbar")).toHaveAttribute(
            "aria-valuenow",
            "75"
        );
        expect(
            screen.getByRole("link", {
                name: /game.page.missions.friend.title/,
            })
        ).toHaveAttribute("href", "/profile/referral/share");
        expect(
            screen.getByRole("link", {
                name: /game.page.missions.purchase.title/,
            })
        ).toHaveAttribute("href", "/explorer");
        expect(
            screen.getByText("game.page.missions.earned:3")
        ).toBeInTheDocument();
        expect(
            screen.getByText("game.page.missions.rewardPerFriend:1")
        ).toBeInTheDocument();
    });

    it("confirms to a certified follower that their Instagram is done, with nothing to open", () => {
        currentGame.data = player(4, true);
        const { container } = render(<GamePage />);

        expect(
            screen.getByText("game.page.missions.instagram.certified.title")
        ).toBeInTheDocument();
        expect(
            container.querySelector('a[href="/profile/instagram"]')
        ).toBeNull();
    });

    it("locks the tickets of a player with no Instagram and gates the first mission", () => {
        currentGame.data = player(2, false);
        render(<GamePage />);

        expect(
            screen.getByText("game.page.hero.pending:2")
        ).toBeInTheDocument();
        expect(
            screen.getByText("game.page.hero.subtitleNone:2")
        ).toBeInTheDocument();
        expect(screen.queryByText("50 € à gagner")).toBeNull();
        const gate = screen.getByRole("link", {
            name: /game.page.missions.instagram.none.title/,
        });
        expect(gate).toHaveAttribute("href", "/profile/instagram");
        expect(gate).toHaveTextContent("game.page.missions.reward:2");
    });

    it("offers a declared player the +2 to certify, their tickets already counting", () => {
        currentGame.data = player(1, true, "declared");
        render(<GamePage />);

        expect(screen.getByText("game.page.hero.drawn:1")).toBeInTheDocument();
        const certify = screen.getByRole("link", {
            name: /game.page.missions.instagram.declared.title/,
        });
        expect(certify).toHaveAttribute("href", "/profile/instagram");
        expect(certify).toHaveTextContent("game.page.missions.reward:2");
    });

    it("tells a certified non-follower to follow again", () => {
        currentGame.data = player(3, false, "certified");
        render(<GamePage />);

        expect(
            screen.getByText("game.page.hero.subtitleNotFollowing:3")
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", {
                name: /game.page.missions.instagram.notFollowing.title/,
            })
        ).toHaveAttribute("href", "/profile/instagram");
    });

    it("tracks a tap on a mission with its status", () => {
        trackEvent.mockReset();
        currentGame.data = player(2, false);
        render(<GamePage />);

        fireEvent.click(
            screen.getByRole("link", {
                name: /game.page.missions.instagram.none.title/,
            })
        );
        fireEvent.click(
            screen.getByRole("link", {
                name: /game.page.missions.friend.title/,
            })
        );

        expect(trackEvent).toHaveBeenCalledWith("game_mission_clicked", {
            mission: "instagram",
            status: "gate",
            surface: "game_page",
            game_id: "d1",
        });
        expect(trackEvent).toHaveBeenCalledWith("game_mission_clicked", {
            mission: "friend",
            status: "todo",
            surface: "game_page",
            game_id: "d1",
        });
    });

    it("shows nothing new on a first visit, then the tickets earned since on the next", () => {
        trackEvent.mockReset();
        currentGame.data = player(4, true);
        const first = render(<GamePage />);
        expect(screen.queryByText("+3")).toBeNull();
        first.unmount();

        currentGame.data = player(7, true);
        render(<GamePage />);

        expect(screen.getByText("+3")).toBeInTheDocument();
        expect(screen.getByText("game.page.hero.since")).toBeInTheDocument();
        expect(
            trackEvent.mock.calls.filter(
                ([name]) => name === "game_progress_shown"
            )
        ).toEqual([
            ["game_progress_shown", { tickets_gained: 3, unlocked: false }],
        ]);
    });

    it("shows the gains once the refetch lands, and the unlock when the tickets start to count", () => {
        trackEvent.mockReset();
        currentGame.data = player(2, false);
        render(<GamePage />).unmount();

        currentGame.data = player(2, false);
        const { rerender } = render(<GamePage />);
        expect(screen.queryByText("game.page.hero.since")).toBeNull();

        currentGame.data = player(4, true);
        rerender(<GamePage />);

        expect(
            screen.getByText("game.page.hero.unlocked:4")
        ).toBeInTheDocument();
        expect(trackEvent).toHaveBeenCalledWith("game_progress_shown", {
            tickets_gained: 2,
            unlocked: true,
        });
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
        fireEvent.click(
            screen.getByRole("button", {
                name: /game.result.pendingVerification.cta/,
            })
        );
        expect(navigate).toHaveBeenCalledWith({ to: "/profile/instagram" });
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
            record: "tied",
        });
    });

    it("points a winner to the prize in their history", () => {
        currentGame.data = NO_GAME;
        gameHistory.data = [result("latest", "won")];
        render(<GamePage />);

        expect(screen.getByText("game.result.won.title")).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: /game.result.won.cta/ })
        );
        expect(navigate).toHaveBeenCalledWith({ to: "/history" });
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

        expect(screen.getByText("game.page.hero.drawn:4")).toBeInTheDocument();
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
                ticketsBySource: {},
                eligible: false,
                instagram: "none",
            },
        };
        gameHistory.data = [result("earlier", "lost")];
        render(<GamePage />);

        expect(screen.queryByText("navigate:/game/join")).toBeNull();
        expect(screen.getByText("game.card.yourTicket")).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: /game.card.ariaLabel/ })
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

        expect(screen.getByText("game.page.hero.drawn:4")).toBeInTheDocument();
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

describe("GamePage result at the top", () => {
    const sources = (purchase: number) => ({
        ticketsBySource: {
            join: 1,
            instagramCertified: 0,
            purchase,
            referredPurchase: 0,
            referredSignup: 0,
            brandShare: 0,
        },
    });
    const top = (
        outcome: GameOutcome,
        overrides: Parameters<typeof gameResult>[0] = {}
    ) => {
        currentGame.data = NO_GAME;
        gameHistory.data = [result("latest", outcome, overrides)];
        trackEvent.mockReset();
        navigate.mockClear();
        return render(<GamePage />);
    };

    beforeEach(() => {
        gameHistory.isLoading = false;
        gameHistory.isError = false;
    });

    it.each([
        ["drawing", "game.result.drawing.title"],
        ["lost", "game.result.lost.title"],
        ["no_winner", "game.result.noWinner.title"],
    ] as const)("shows the record chip on %s", (outcome, title) => {
        top(outcome);

        expect(screen.getByText(title)).toBeInTheDocument();
        expect(
            screen.getByText("game.result.hero.record.first:7")
        ).toBeInTheDocument();
    });

    it.each([
        ["won", "game.result.won.title"],
        ["pending_verification", "game.result.pendingVerification.title"],
    ] as const)("leaves the record out of %s", (outcome, title) => {
        top(outcome, { verifyBy: new Date(Date.now() + 3_600_000) });

        expect(screen.getByText(title)).toBeInTheDocument();
        expect(screen.queryByText(/game.result.hero.record/)).toBeNull();
    });

    it("states the draw to a player in a draw still running", () => {
        top("drawing");

        expect(
            screen.getByText("game.result.hero.drawingOf:7")
        ).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /cta/ })).toBeNull();
    });

    it("drops the out-of when the draw size is not known yet", () => {
        top("drawing", { totalTickets: null });

        expect(
            screen.getByText("game.result.hero.drawing:7")
        ).toBeInTheDocument();
    });

    it("sends a drawn player to certify with one button, the countdown and the deadline", () => {
        top("pending_verification", {
            verifyBy: new Date(Date.now() + 21 * 3_600_000 + 60_000),
        });

        expect(
            screen.getAllByText(/game.result.pendingVerification.cta/)
        ).toHaveLength(1);
        expect(
            screen.getByText("game.result.hero.timeLeftHours")
        ).toBeInTheDocument();
        expect(
            screen.getByText("game.result.hero.deadline")
        ).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /cta/ })).toBeNull();
    });

    it("counts the last minutes of the deadline in minutes", () => {
        top("pending_verification", {
            verifyBy: new Date(Date.now() + 20 * 60_000),
        });

        expect(
            screen.getByText("game.result.hero.timeLeftMinutes")
        ).toBeInTheDocument();
    });

    it("drops the countdown once the deadline has passed", () => {
        top("pending_verification", {
            verifyBy: new Date(Date.now() - 60_000),
        });

        expect(screen.queryByText(/game.result.hero.timeLeft/)).toBeNull();
        expect(screen.getByText("game.history.gameOf")).toBeInTheDocument();
    });

    it("gives a winner one button to the prize", () => {
        top("won");

        expect(screen.getAllByText(/game.result.won.cta/)).toHaveLength(1);
    });

    it("points a loser to the next game on Instagram", () => {
        top("lost");

        expect(
            screen.getByRole("link", { name: /game.result.hero.next/ })
        ).toHaveAttribute("href", FRAK_INSTAGRAM_URL);
    });

    it("says the tickets were not in the draw when they were discarded", () => {
        top("lost", { discarded: "not_following", drawTickets: 0 });

        expect(
            screen.getByText("game.result.hero.discarded")
        ).toBeInTheDocument();
        expect(screen.queryByText(/game.result.hero.lost/)).toBeNull();
        expect(screen.getByText("game.result.discarded")).toBeInTheDocument();
    });

    it("says a tie in tickets is a tied record", () => {
        currentGame.data = NO_GAME;
        gameHistory.data = [
            result("latest", "lost", sources(10)),
            result("old", "lost", sources(10)),
        ];
        render(<GamePage />);

        expect(
            screen.getByText("game.result.hero.record.tied:11")
        ).toBeInTheDocument();
    });

    it("leaves the record chip out of a discarded result but still tracks it", () => {
        top("lost", { discarded: "not_following", drawTickets: 0 });

        expect(screen.queryByText(/game.result.hero.record/)).toBeNull();
        expect(trackEvent).toHaveBeenCalledWith(
            "game_result_viewed",
            expect.objectContaining({ record: "first" })
        );
    });

    it.each([
        ["first", []],
        ["new", [result("old", "lost", sources(2))]],
        ["tied", [result("old", "lost", sources(10))]],
        ["held", [result("old", "lost", sources(30))]],
    ] as const)(
        "tracks the %s record with the result viewed",
        (record, older) => {
            currentGame.data = NO_GAME;
            trackEvent.mockReset();
            gameHistory.data = [
                result("latest", "lost", sources(10)),
                ...older,
            ];
            render(<GamePage />);

            expect(trackEvent).toHaveBeenCalledWith("game_result_viewed", {
                game_id: "latest",
                outcome: "lost",
                record,
            });
        }
    );
});
