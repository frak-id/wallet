import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pathnameMock } = vi.hoisted(() => ({
    pathnameMock: vi.fn(() => "/m/store-1/members"),
}));

vi.mock("@tanstack/react-router", () => ({
    useLocation: () => ({ pathname: pathnameMock() }),
}));

import { onboardingTourStore } from "@/stores/onboardingTourStore";
import { PageTourButton } from "./index";

describe("PageTourButton", () => {
    beforeEach(() => {
        pathnameMock.mockReturnValue("/m/store-1/members");
        onboardingTourStore.setState({
            welcomeStatus: "dismissed",
            activeTour: null,
            stepIndex: 0,
        });
    });

    it("opens the tour of the current page", () => {
        render(<PageTourButton />);

        fireEvent.click(
            screen.getByRole("button", { name: "onboarding.pageTour.button" })
        );

        expect(onboardingTourStore.getState().activeTour).toBe("members");
    });

    it("opens another tour on another page", () => {
        pathnameMock.mockReturnValue("/settings/billing");
        render(<PageTourButton />);

        fireEvent.click(screen.getByRole("button"));

        expect(onboardingTourStore.getState().activeTour).toBe("billing");
    });

    it("tells assistive tech that it opens a dialog", () => {
        render(<PageTourButton />);
        const button = screen.getByRole("button");

        expect(button).toHaveAttribute("aria-haspopup", "dialog");
        expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("is hidden on Frak staff pages", () => {
        pathnameMock.mockReturnValue("/internal/bank");
        render(<PageTourButton />);

        expect(screen.queryByRole("button")).toBeNull();
    });
});
