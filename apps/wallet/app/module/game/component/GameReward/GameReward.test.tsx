import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { confetti, create } = vi.hoisted(() => {
    const confetti = Object.assign(vi.fn(), { reset: vi.fn() });
    return { confetti, create: vi.fn(() => confetti) };
});

vi.mock("canvas-confetti", () => ({ default: { create } }));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "fr-FR" },
    }),
}));

import { GameReward } from "./index";

describe("GameReward", () => {
    it("fires the confetti bursts on mount, respecting reduced motion", async () => {
        confetti.mockClear();
        render(<GameReward onContinue={vi.fn()} />);

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
        const { unmount } = render(<GameReward onContinue={vi.fn()} />);
        await waitFor(() => expect(confetti).toHaveBeenCalled());

        unmount();

        expect(confetti.reset).toHaveBeenCalledTimes(1);
    });

    it("does not fire when unmounted before the library has loaded", async () => {
        confetti.mockClear();
        confetti.reset.mockClear();
        render(<GameReward onContinue={vi.fn()} />).unmount();

        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(confetti).not.toHaveBeenCalled();
        expect(confetti.reset).not.toHaveBeenCalled();
    });

    it("shows the formatted reward and continues on tap", () => {
        const onContinue = vi.fn();
        render(<GameReward onContinue={onContinue} />);

        expect(screen.getByText(/^1\s€$/)).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: "onboarding.continue" })
        );
        expect(onContinue).toHaveBeenCalled();
    });
});
