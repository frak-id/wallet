import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLeaderboard } from "@/module/game/hook/useLeaderboard";
import type { Leaderboard } from "@/module/game/types";
import { LeaderboardPage } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, values?: Record<string, string | number>) =>
            values ? `${key} ${JSON.stringify(values)}` : key,
        i18n: { language: "fr-FR" },
    }),
}));

vi.mock("@/module/common/component/Back", () => ({
    Back: () => null,
}));

vi.mock("@/module/game/hook/useLeaderboard", () => ({
    useLeaderboard: vi.fn(),
}));

const leaderboard: Leaderboard = {
    entries: [
        { rank: 1, displayName: "Camille D.", score: 4820, isMe: false },
        { rank: 2, displayName: "Lucas_92", score: 1200, isMe: false },
    ],
    me: { rank: 23, score: 860 },
};

function mockQuery(state: {
    data?: Leaderboard;
    isLoading?: boolean;
    error?: Error | null;
    refetch?: () => void;
}) {
    vi.mocked(useLeaderboard).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        ...state,
    } as unknown as ReturnType<typeof useLeaderboard>);
}

describe("LeaderboardPage", () => {
    beforeEach(() => {
        vi.mocked(useLeaderboard).mockReset();
    });

    it("lists the players in rank order with formatted scores", () => {
        mockQuery({ data: leaderboard });
        render(<LeaderboardPage />);

        const rows = within(screen.getByRole("list")).getAllByRole("listitem");
        expect(rows).toHaveLength(2);
        expect(rows[0].textContent).toContain("1. Camille D.");
        expect(rows[0].textContent).toMatch(/"score":"4\s820"/);
        expect(rows[1].textContent).toContain("2. Lucas_92");
    });

    it("shows the rank and score of the current player", () => {
        mockQuery({ data: leaderboard });
        render(<LeaderboardPage />);

        expect(
            screen.getByText(/game\.leaderboard\.myRank/).textContent
        ).toContain('"rank":23');
        expect(
            screen.queryByText("game.leaderboard.notRanked")
        ).not.toBeInTheDocument();
    });

    it("marks the player's row and drops the rank block when they are listed", () => {
        mockQuery({
            data: {
                entries: [
                    { ...leaderboard.entries[0] },
                    { ...leaderboard.entries[1], isMe: true },
                ],
                me: { rank: 2, score: 1200 },
            },
        });
        render(<LeaderboardPage />);

        const rows = within(screen.getByRole("list")).getAllByRole("listitem");
        expect(
            within(rows[1]).getByText("game.leaderboard.you")
        ).toBeInTheDocument();
        expect(
            within(rows[0]).queryByText("game.leaderboard.you")
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText(/game\.leaderboard\.myRank/)
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText("game.leaderboard.notRanked")
        ).not.toBeInTheDocument();
    });

    it("shows no badge when the player is outside the list", () => {
        mockQuery({ data: leaderboard });
        render(<LeaderboardPage />);

        expect(
            screen.queryByText("game.leaderboard.you")
        ).not.toBeInTheDocument();
    });

    it("says the player is not ranked yet when there is no rank", () => {
        mockQuery({ data: { ...leaderboard, me: null } });
        render(<LeaderboardPage />);

        expect(
            screen.getByText("game.leaderboard.notRanked")
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/game\.leaderboard\.myRank/)
        ).not.toBeInTheDocument();
    });

    it("shows the empty state without a list when nobody has scored", () => {
        mockQuery({ data: { entries: [], me: null } });
        render(<LeaderboardPage />);

        expect(
            screen.getByText("game.leaderboard.empty.title")
        ).toBeInTheDocument();
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("retries the query from the error state", () => {
        const refetch = vi.fn();
        mockQuery({ error: new Error("boom"), refetch });
        render(<LeaderboardPage />);

        fireEvent.click(
            screen.getByRole("button", { name: "game.leaderboard.error.retry" })
        );

        expect(refetch).toHaveBeenCalledTimes(1);
    });

    it("shows neither list nor error while loading", () => {
        mockQuery({ isLoading: true });
        render(<LeaderboardPage />);

        expect(screen.queryByRole("list")).not.toBeInTheDocument();
        expect(
            screen.queryByText("game.leaderboard.error.title")
        ).not.toBeInTheDocument();
    });
});
