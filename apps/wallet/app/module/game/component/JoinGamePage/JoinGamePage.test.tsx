import type { RedeemResult } from "@frak-labs/wallet-shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { navigate, invalidateQueries, redeemResult } = vi.hoisted(() => ({
    navigate: vi.fn(),
    invalidateQueries: vi.fn(),
    redeemResult: { current: { kind: "frak" } as RedeemResult },
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({ invalidateQueries }),
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/module/common/component/Back", () => ({ Back: () => null }));
vi.mock("@/module/referral/component/RedeemReferralCodePage", () => ({
    RedeemForm: ({
        onRedeemed,
        initialCode,
        submitLabel,
    }: {
        onRedeemed: (result: RedeemResult) => void;
        initialCode?: string;
        submitLabel?: string;
    }) => (
        <button type="button" onClick={() => onRedeemed(redeemResult.current)}>
            {submitLabel} {initialCode}
        </button>
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

import { JoinGamePage } from "./index";

const game = {
    id: "d1",
    prizeAmount: 50,
    prizeDescription: "game-prize",
    startsAt: new Date(),
    endsAt: new Date(),
    sponsor: null,
} as unknown as NonNullable<RedeemResult["game"]>;

describe("JoinGamePage", () => {
    beforeEach(() => {
        navigate.mockClear();
        invalidateQueries.mockClear();
    });

    it("pre-fills the code and shows the confetti screen once the game is joined", () => {
        redeemResult.current = { kind: "frak", game, gameReward: 1 };
        render(<JoinGamePage initialCode="FRAK26" />);

        fireEvent.click(screen.getByRole("button", { name: /FRAK26/ }));
        expect(screen.getByText(/reward-1 game-prize/)).toBeInTheDocument();
        expect(invalidateQueries).toHaveBeenCalledWith({
            queryKey: ["game", "current"],
        });

        fireEvent.click(screen.getByText(/reward-1/));
        expect(navigate).toHaveBeenCalledWith({ to: "/game", replace: true });
    });

    it("goes straight to the game page when re-joining a game without a reward", () => {
        redeemResult.current = { kind: "frak", game };
        render(<JoinGamePage initialCode="FRAK26" />);

        fireEvent.click(screen.getByRole("button", { name: /FRAK26/ }));

        expect(navigate).toHaveBeenCalledWith({ to: "/game", replace: true });
        expect(invalidateQueries).toHaveBeenCalledWith({
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
