import type { RedeemResult } from "@frak-labs/wallet-shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    currentGame,
    gameHistory,
    navigate,
    refetchQueries,
    redeemResult,
    trackEvent,
} = vi.hoisted(() => ({
    trackEvent: vi.fn(),
    navigate: vi.fn(),
    refetchQueries: vi.fn(() => Promise.resolve()),
    redeemResult: { current: { kind: "frak" } as RedeemResult },
    currentGame: { data: undefined as unknown, isLoading: false },
    gameHistory: { data: [] as unknown[] },
}));

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => navigate,
    Link: () => null,
}));
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    trackEvent,
}));
vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({ refetchQueries }),
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, values?: { prize?: string }) =>
            values?.prize === undefined ? key : `${key}:${values.prize}`,
        i18n: { language: "en" },
    }),
}));
vi.mock("@/module/common/component/Back", () => ({ Back: () => null }));
vi.mock("@/module/game/hook/useCurrentGame", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    useCurrentGame: () => currentGame,
}));
vi.mock("@/module/game/hook/useGameHistory", () => ({
    useGameHistory: () => gameHistory,
}));
vi.mock("@/module/referral/component/RedeemReferralCodePage", () => ({
    RedeemForm: ({
        onRedeemed,
        onError,
        initialCode,
        submitLabel,
    }: {
        onRedeemed: (result: RedeemResult) => void;
        onError?: (errorKey: string) => void;
        initialCode?: string;
        submitLabel?: string;
    }) => (
        <>
            <button
                type="button"
                onClick={() => onRedeemed(redeemResult.current)}
            >
                {submitLabel} {initialCode}
            </button>
            <button type="button" onClick={() => onError?.("error-key")}>
                fail
            </button>
        </>
    ),
}));
vi.mock("@/module/game/component/GameReward", () => ({
    GameReward: ({
        reward,
        game,
        onContinue,
    }: {
        reward: number;
        game?: { prizeDescription: string };
        onContinue: () => void;
    }) => (
        <button type="button" onClick={onContinue}>
            reward-{reward} {game?.prizeDescription}
        </button>
    ),
}));

import { modalStore } from "@/module/stores/modalStore";
import { gameResult } from "@/tests/gameFixtures";
import { JoinGamePage } from "./index";

const game = {
    id: "d1",
    prizeAmount: 50,
    prizeDescription: "game-prize",
    startsAt: new Date(),
    endsAt: new Date(),
    sponsor: null,
} as unknown as NonNullable<RedeemResult["game"]>;

const openGame = (participating: boolean, prizeDescription: string | null) => ({
    game: {
        ...game,
        prizeDescription,
        endsAt: new Date(Date.now() + 3 * 24 * 3_600_000),
    },
    me: { participating, tickets: participating ? 1 : 0 },
});

describe("JoinGamePage", () => {
    beforeEach(() => {
        navigate.mockClear();
        refetchQueries.mockClear();
        trackEvent.mockClear();
        currentGame.data = undefined;
        currentGame.isLoading = false;
        gameHistory.data = [];
        modalStore.getState().dismissAll();
    });

    it("shows the open game's prize and time left before the user joins", () => {
        currentGame.data = openGame(false, null);
        render(<JoinGamePage />);

        expect(screen.getByText("game.join.hero.title")).toBeInTheDocument();
        expect(screen.getByText("game.join.firstTicket")).toBeInTheDocument();
        expect(screen.getByText("game.prizeToWin:€50")).toBeInTheDocument();
        expect(
            screen.getByText("game.page.hero.countdownDays")
        ).toBeInTheDocument();
    });

    it("shows a prize description as it is", () => {
        currentGame.data = openGame(false, "A weekend for two");
        render(<JoinGamePage />);

        expect(screen.getByText("A weekend for two")).toBeInTheDocument();
        expect(screen.queryByText(/game.prizeToWin/)).toBeNull();
    });

    it("leaves the hero out for a player already in the game", () => {
        currentGame.data = openGame(true, null);
        render(<JoinGamePage />);

        expect(screen.queryByText("game.join.hero.title")).toBeNull();
        expect(screen.getByText("game.join.description")).toBeInTheDocument();
    });

    it("lists the past games under the code form, each opening its result", () => {
        currentGame.data = openGame(false, null);
        const earlier = gameResult({
            game: { id: "earlier" },
            outcome: "lost",
        });
        gameHistory.data = [earlier];
        render(<JoinGamePage />);

        expect(screen.getByText("game.history.title")).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: /game.history.gameOf/ })
        );
        expect(modalStore.getState().modal).toEqual({
            id: "gameResult",
            result: earlier,
        });
    });

    it("tracks the screen view with whether the code was pre-filled", () => {
        render(<JoinGamePage initialCode="FRAK26" />);

        expect(trackEvent).toHaveBeenCalledWith("game_code_entry_viewed", {
            prefilled: true,
        });
    });

    it.each([
        { name: "a join", result: { kind: "frak", game }, outcome: "joined" },
        {
            name: "a friend's code",
            result: { kind: "user" },
            outcome: "referrer_set",
        },
    ] as const)("tracks $name as $outcome", ({ result, outcome }) => {
        redeemResult.current = result as RedeemResult;
        render(<JoinGamePage initialCode="LOLA10" />);

        fireEvent.click(screen.getByRole("button", { name: /LOLA10/ }));

        expect(trackEvent).toHaveBeenCalledWith("game_code_submitted", {
            outcome,
        });
    });

    it("tracks a rejected code with its error key", () => {
        render(<JoinGamePage />);

        fireEvent.click(screen.getByRole("button", { name: "fail" }));

        expect(trackEvent).toHaveBeenCalledWith("game_code_submitted", {
            outcome: "error",
            error_key: "error-key",
        });
    });

    it("pre-fills the code and shows the confetti screen once the game is joined", () => {
        redeemResult.current = { kind: "frak", game, gameReward: 1 };
        render(<JoinGamePage initialCode="FRAK26" />);

        fireEvent.click(screen.getByRole("button", { name: /FRAK26/ }));
        expect(screen.getByText(/reward-1 game-prize/)).toBeInTheDocument();
        expect(refetchQueries).toHaveBeenCalledWith({
            queryKey: ["game", "current"],
        });

        fireEvent.click(screen.getByText(/reward-1/));
        expect(navigate).toHaveBeenCalledWith({ to: "/game", replace: true });
    });

    it("goes to the game page once the game is refetched when joining without a reward", async () => {
        let refetchDone = () => {};
        refetchQueries.mockReturnValueOnce(
            new Promise<void>((resolve) => {
                refetchDone = resolve;
            })
        );
        redeemResult.current = { kind: "frak", game };
        render(<JoinGamePage initialCode="FRAK26" />);

        fireEvent.click(screen.getByRole("button", { name: /FRAK26/ }));
        expect(navigate).not.toHaveBeenCalled();

        refetchDone();
        await waitFor(() =>
            expect(navigate).toHaveBeenCalledWith({
                to: "/game",
                replace: true,
            })
        );
        expect(refetchQueries).toHaveBeenCalledWith({
            queryKey: ["game", "current"],
        });
        expect(screen.queryByText(/reward-/)).not.toBeInTheDocument();
    });

    it("hands a friend's code back to the referral page", () => {
        redeemResult.current = { kind: "user" };
        render(<JoinGamePage initialCode="LOLA10" />);

        fireEvent.click(screen.getByRole("button", { name: /LOLA10/ }));

        expect(navigate).toHaveBeenCalledWith({
            to: "/profile/referral/redeem",
            replace: true,
        });
        expect(screen.queryByText(/reward-/)).not.toBeInTheDocument();
    });
});
