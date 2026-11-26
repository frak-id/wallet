import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pathnameMock, demoModeMock, bareShellMock, walletMock } = vi.hoisted(
    () => ({
        pathnameMock: vi.fn(() => "/m/store-1/dashboard"),
        demoModeMock: vi.fn(() => false),
        bareShellMock: vi.fn(() => false),
        walletMock: vi.fn(() => true),
    })
);

vi.mock("@tanstack/react-router", () => ({
    useLocation: () => ({ pathname: pathnameMock() }),
}));
vi.mock("@/module/common/atoms/demoMode", () => ({
    useIsDemoMode: demoModeMock,
}));
vi.mock("@/module/common/hook/useIsBareShell", () => ({
    useIsBareShell: bareShellMock,
}));
vi.mock("@/module/common/hook/useCapabilities", () => ({
    useCapabilities: () => ({ canOnchain: walletMock() }),
}));

import { onboardingTourStore } from "@/stores/onboardingTourStore";
import { welcomePopupStore } from "@/stores/welcomePopupStore";
import { OnboardingTour } from "./index";

const resetStores = (welcomeStatus: "pending" | "dismissed" = "pending") => {
    onboardingTourStore.setState({
        welcomeStatus,
        activeTour: null,
        stepIndex: 0,
    });
    welcomePopupStore.setState({ hasSeenWelcome: true });
};

describe("OnboardingTour", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        pathnameMock.mockReturnValue("/m/store-1/dashboard");
        demoModeMock.mockReturnValue(false);
        bareShellMock.mockReturnValue(false);
        walletMock.mockReturnValue(true);
        resetStores();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("opening", () => {
        it("renders nothing when no tour is active", () => {
            resetStores("dismissed");
            render(<OnboardingTour />);

            expect(screen.queryByRole("dialog")).toBeNull();
        });

        it("exposes the step as a labelled dialog and focuses it", () => {
            resetStores("dismissed");
            render(<OnboardingTour />);
            act(() => onboardingTourStore.getState().startTour("welcome"));

            const dialog = screen.getByRole("dialog");
            expect(dialog).toHaveAccessibleName(
                "onboarding.welcome.intro.title"
            );
            expect(dialog).toHaveAccessibleDescription(
                "onboarding.welcome.intro.body"
            );
            expect(dialog).toHaveFocus();
            expect(screen.getByText("onboarding.progress")).toBeInTheDocument();
        });
    });

    describe("navigation", () => {
        let view: ReturnType<typeof render>;

        beforeEach(() => {
            resetStores("dismissed");
            view = render(<OnboardingTour />);
            act(() => onboardingTourStore.getState().startTour("welcome"));
        });

        it("goes to the next and previous step with the buttons", () => {
            fireEvent.click(screen.getByText("onboarding.actions.next"));
            expect(screen.getByRole("dialog")).toHaveAccessibleName(
                "onboarding.welcome.stores.title"
            );

            fireEvent.click(screen.getByText("onboarding.actions.back"));
            expect(screen.getByRole("dialog")).toHaveAccessibleName(
                "onboarding.welcome.intro.title"
            );
        });

        it("goes to the next and previous step with the arrow keys", () => {
            fireEvent.keyDown(screen.getByRole("dialog"), {
                key: "ArrowRight",
            });
            expect(onboardingTourStore.getState().stepIndex).toBe(1);

            fireEvent.keyDown(screen.getByRole("dialog"), {
                key: "ArrowLeft",
            });
            expect(onboardingTourStore.getState().stepIndex).toBe(0);
        });

        it("keeps focus on the card when the step changes", () => {
            screen.getByText("onboarding.actions.next").focus();
            fireEvent.click(screen.getByText("onboarding.actions.next"));

            expect(screen.getByRole("dialog")).toHaveFocus();
        });

        it("closes on Escape and remembers the dismissal", () => {
            fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

            expect(screen.queryByRole("dialog")).toBeNull();
            expect(onboardingTourStore.getState().welcomeStatus).toBe(
                "dismissed"
            );
        });

        it("can be skipped", () => {
            fireEvent.click(screen.getByText("onboarding.actions.skip"));

            expect(screen.queryByRole("dialog")).toBeNull();
            expect(onboardingTourStore.getState().welcomeStatus).toBe(
                "dismissed"
            );
        });

        it("remembers completion on the last step", () => {
            const lastStep = 8;
            act(() => onboardingTourStore.getState().setStep(lastStep));

            expect(
                screen.queryByText("onboarding.actions.skip")
            ).not.toBeInTheDocument();
            fireEvent.click(screen.getByText("onboarding.actions.done"));

            expect(screen.queryByRole("dialog")).toBeNull();
            expect(onboardingTourStore.getState().welcomeStatus).toBe(
                "completed"
            );
        });

        it("closes when the user goes to another page", () => {
            pathnameMock.mockReturnValue("/m/store-1/members");
            view.rerender(<OnboardingTour />);

            expect(onboardingTourStore.getState().activeTour).toBeNull();
        });
    });

    describe("steps", () => {
        it("skips the wallet step when a wallet is linked", () => {
            resetStores("dismissed");
            render(<OnboardingTour />);
            act(() => onboardingTourStore.getState().startTour("welcome"));
            act(() => onboardingTourStore.getState().setStep(3));

            expect(screen.getByRole("dialog")).toHaveAccessibleName(
                "onboarding.welcome.payouts.title"
            );
        });

        it("adds the optional wallet step when no wallet is linked", () => {
            walletMock.mockReturnValue(false);
            resetStores("dismissed");
            render(<OnboardingTour />);
            act(() => onboardingTourStore.getState().startTour("welcome"));
            act(() => onboardingTourStore.getState().setStep(3));

            expect(screen.getByRole("dialog")).toHaveAccessibleName(
                "onboarding.welcome.linkWallet.title"
            );
        });

        const mountTarget = () => {
            const target = document.createElement("button");
            target.setAttribute("data-tour", "store-budget");
            target.getBoundingClientRect = () =>
                ({ top: 10, left: 20, width: 100, height: 30 }) as DOMRect;
            target.scrollIntoView = vi.fn();
            document.body.append(target);
            resetStores("dismissed");
            render(<OnboardingTour />);
            act(() => onboardingTourStore.getState().startTour("stores"));
            act(() => onboardingTourStore.getState().setStep(1));
            act(() => {
                vi.advanceTimersByTime(1000);
            });
            return target;
        };

        const setReducedMotion = (matches: boolean) =>
            vi
                .spyOn(window, "matchMedia")
                .mockImplementation(
                    (query) => ({ matches, media: query }) as MediaQueryList
                );

        it("scrolls smoothly to the target element once", () => {
            setReducedMotion(false);
            const target = mountTarget();

            expect(target.scrollIntoView).toHaveBeenCalledTimes(1);
            expect(target.scrollIntoView).toHaveBeenCalledWith(
                expect.objectContaining({ behavior: "smooth" })
            );
            target.remove();
        });

        it("does not animate the scroll when the user prefers reduced motion", () => {
            setReducedMotion(true);
            const target = mountTarget();

            expect(target.scrollIntoView).toHaveBeenCalledWith(
                expect.objectContaining({ behavior: "auto" })
            );
            target.remove();
        });

        it("offers the full tour from a page tour", () => {
            resetStores("dismissed");
            render(<OnboardingTour />);
            act(() => onboardingTourStore.getState().startTour("stores"));

            fireEvent.click(screen.getByText("onboarding.actions.fullTour"));

            expect(onboardingTourStore.getState().activeTour).toBe("welcome");
        });
    });

    describe("automatic start", () => {
        const startsAfterDelay = () => {
            render(<OnboardingTour />);
            act(() => {
                vi.advanceTimersByTime(600);
            });
            return onboardingTourStore.getState().activeTour === "welcome";
        };

        it("starts for a new user who closed the announcement", () => {
            expect(startsAfterDelay()).toBe(true);
        });

        it("does not start again once it was finished or skipped", () => {
            resetStores("dismissed");
            expect(startsAfterDelay()).toBe(false);
        });

        it("waits for the announcement popup to be closed", () => {
            welcomePopupStore.setState({ hasSeenWelcome: false });
            expect(startsAfterDelay()).toBe(false);
        });

        it("does not start in demo mode", () => {
            demoModeMock.mockReturnValue(true);
            expect(startsAfterDelay()).toBe(false);
        });

        it("does not start on a wizard page", () => {
            bareShellMock.mockReturnValue(true);
            pathnameMock.mockReturnValue("/m/store-1/campaigns/draft/new");
            expect(startsAfterDelay()).toBe(false);
        });
    });
});
