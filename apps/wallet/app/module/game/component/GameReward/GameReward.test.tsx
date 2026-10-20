import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { confetti, create } = vi.hoisted(() => {
    const confetti = Object.assign(vi.fn(), { reset: vi.fn() });
    return { confetti, create: vi.fn(() => confetti) };
});

vi.mock("canvas-confetti", () => ({ default: { create } }));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, values?: Record<string, string>) =>
            values ? `${key} ${JSON.stringify(values)}` : key,
        i18n: { language: "fr-FR" },
    }),
}));

import { GameReward } from "./index";

describe("GameReward", () => {
    it("fires the confetti bursts on mount, respecting reduced motion", async () => {
        confetti.mockClear();
        render(<GameReward reward={1} onContinue={vi.fn()} />);

        await waitFor(() => expect(confetti).toHaveBeenCalledTimes(2));
        expect(create).toHaveBeenCalledWith(
            undefined,
            expect.objectContaining({ disableForReducedMotion: true })
        );
        expect(confetti).toHaveBeenCalledWith(
            expect.objectContaining({ disableForReducedMotion: true })
        );
    });

    it("resets the confetti canvas on unmount", async () => {
        confetti.reset.mockClear();
        const { unmount } = render(
            <GameReward reward={1} onContinue={vi.fn()} />
        );
        await waitFor(() => expect(confetti).toHaveBeenCalled());

        unmount();

        expect(confetti.reset).toHaveBeenCalledTimes(1);
    });

    it("does not fire when unmounted before the library has loaded", async () => {
        confetti.mockClear();
        confetti.reset.mockClear();
        render(<GameReward reward={1} onContinue={vi.fn()} />).unmount();

        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(confetti).not.toHaveBeenCalled();
        expect(confetti.reset).not.toHaveBeenCalled();
    });

    it("shows the earned reward and continues on tap", () => {
        const onContinue = vi.fn();
        render(<GameReward reward={2.5} onContinue={onContinue} />);

        expect(screen.getByText(/^2,50\s€$/)).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: "onboarding.continue" })
        );
        expect(onContinue).toHaveBeenCalled();
    });

    it("shows the joined drop's prize, end date and sponsor", () => {
        render(
            <GameReward
                reward={1}
                onContinue={vi.fn()}
                drop={{
                    id: "d1",
                    prizeDescription: "100 € en bon d'achat",
                    reward: 1,
                    startsAt: new Date("2026-10-21T18:00:00Z"),
                    endsAt: new Date("2026-10-23T18:00:00Z"),
                    sponsor: {
                        id: "m1",
                        name: "Oolution",
                        domain: "oolution.com",
                    },
                }}
            />
        );

        expect(screen.getByText("100 € en bon d'achat")).toBeInTheDocument();
        expect(screen.getByText(/reward\.drop\.endsAt/).textContent).toMatch(
            /octobre/
        );
        expect(screen.getByText(/reward\.drop\.sponsor/).textContent).toContain(
            "Oolution"
        );
    });

    it("shows no drop card for a friend's code", () => {
        render(<GameReward reward={1} onContinue={vi.fn()} />);

        expect(
            screen.queryByText("onboarding.game.reward.drop.label")
        ).not.toBeInTheDocument();
    });
});
