import { act, fireEvent, render, screen } from "@testing-library/react";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    type Mock,
    vi,
} from "vitest";
import type { StartTourOptions } from "@/module/onboarding/driverTour";

const { pathnameMock, demoModeMock, bareShellMock, walletMock, startMock } =
    vi.hoisted(() => ({
        pathnameMock: vi.fn(() => "/m/store-1/dashboard"),
        demoModeMock: vi.fn(() => false),
        bareShellMock: vi.fn(() => false),
        walletMock: vi.fn(() => true),
        startMock: vi.fn(),
    }));

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
vi.mock("@/module/onboarding/driverTour", () => ({
    startDriverTour: startMock,
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

const flush = () =>
    act(async () => {
        await Promise.resolve();
    });

describe("OnboardingTour", () => {
    let stopTour: Mock<() => void>;

    const lastOptions = (): StartTourOptions => {
        const call = startMock.mock.calls.at(-1);
        if (!call) throw new Error("the tour was not started");
        return call[0];
    };

    beforeEach(() => {
        vi.useFakeTimers();
        stopTour = vi.fn<() => void>();
        startMock.mockReset();
        startMock.mockImplementation(async () => stopTour);
        pathnameMock.mockReturnValue("/m/store-1/dashboard");
        demoModeMock.mockReturnValue(false);
        bareShellMock.mockReturnValue(false);
        walletMock.mockReturnValue(true);
        resetStores();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("running a tour", () => {
        beforeEach(() => {
            resetStores("dismissed");
        });

        const open = async (tourId: "welcome" | "stores" = "welcome") => {
            const view = render(<OnboardingTour />);
            act(() => onboardingTourStore.getState().startTour(tourId));
            await flush();
            return view;
        };

        it("starts nothing when no tour is active", async () => {
            render(<OnboardingTour />);
            await flush();

            expect(startMock).not.toHaveBeenCalled();
        });

        it("starts the welcome tour as skippable, without the full-tour link", async () => {
            await open("welcome");

            expect(startMock).toHaveBeenCalledTimes(1);
            expect(lastOptions()).toMatchObject({
                canSkip: true,
                canOpenFullTour: false,
                startIndex: 0,
            });
            expect(lastOptions().steps).toHaveLength(8);
        });

        it("adds the optional wallet step when no wallet is linked", async () => {
            walletMock.mockReturnValue(false);
            await open("welcome");

            const ids = lastOptions().steps.map((step) => step.id);
            expect(ids).toHaveLength(9);
            expect(ids).toContain("linkWallet");
        });

        it("starts a page tour with the full-tour link and no skip", async () => {
            await open("stores");

            expect(lastOptions()).toMatchObject({
                canSkip: false,
                canOpenFullTour: true,
            });
        });

        it("gives the tour translated labels", async () => {
            await open("welcome");

            const { labels } = lastOptions();
            expect(labels.next).toBe("onboarding.actions.next");
            expect(labels.skip).toBe("onboarding.actions.skip");
            expect(labels.progress(2, 8)).toBe("onboarding.progress");
        });

        it("mirrors the current step in the store", async () => {
            await open("welcome");

            act(() => lastOptions().onStep(3));

            expect(onboardingTourStore.getState().stepIndex).toBe(3);
        });

        it("remembers completion", async () => {
            await open("welcome");

            act(() => lastOptions().onEnd("completed"));

            expect(onboardingTourStore.getState().activeTour).toBeNull();
            expect(onboardingTourStore.getState().welcomeStatus).toBe(
                "completed"
            );
        });

        it("remembers a dismissal", async () => {
            await open("welcome");

            act(() => lastOptions().onEnd("dismissed"));

            expect(onboardingTourStore.getState().welcomeStatus).toBe(
                "dismissed"
            );
        });

        it("keeps the welcome status when a page tour ends", async () => {
            onboardingTourStore.setState({ welcomeStatus: "pending" });
            await open("stores");

            act(() => lastOptions().onEnd("completed"));

            expect(onboardingTourStore.getState().welcomeStatus).toBe(
                "pending"
            );
        });

        it("opens the full tour from a page tour", async () => {
            await open("stores");

            act(() => lastOptions().onOpenFullTour());
            await flush();

            expect(onboardingTourStore.getState().activeTour).toBe("welcome");
            expect(startMock).toHaveBeenCalledTimes(2);
            expect(stopTour).toHaveBeenCalledTimes(1);
        });

        it("stops the tour when the component goes away", async () => {
            const view = await open("welcome");

            view.unmount();

            expect(stopTour).toHaveBeenCalledTimes(1);
        });

        it("stops a tour that finished loading after it was closed", async () => {
            let finishLoading: (stop: () => void) => void = () => undefined;
            startMock.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        finishLoading = resolve;
                    })
            );
            await open("welcome");

            act(() => onboardingTourStore.getState().closeTour("dismissed"));
            await act(async () => finishLoading(stopTour));

            expect(stopTour).toHaveBeenCalledTimes(1);
        });

        it("closes quietly when the tour cannot load", async () => {
            onboardingTourStore.setState({ welcomeStatus: "pending" });
            startMock.mockRejectedValue(new Error("chunk failed"));
            await open("welcome");

            expect(onboardingTourStore.getState().activeTour).toBeNull();
            expect(onboardingTourStore.getState().welcomeStatus).toBe(
                "pending"
            );
        });

        it("closes when the user goes to another page", async () => {
            const view = await open("welcome");

            pathnameMock.mockReturnValue("/m/store-1/members");
            view.rerender(<OnboardingTour />);

            expect(onboardingTourStore.getState().activeTour).toBeNull();
            expect(stopTour).toHaveBeenCalled();
        });

        it("gives the focus back to where it was when the tour closes", async () => {
            const opener = document.createElement("button");
            document.body.append(opener);
            opener.focus();
            await open("welcome");
            document.body.focus();

            act(() => lastOptions().onEnd("dismissed"));

            expect(opener).toHaveFocus();
            opener.remove();
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

        it("does not start over the budget sheet", () => {
            pathnameMock.mockReturnValue("/m/store-1/merchant/funding");
            expect(startsAfterDelay()).toBe(false);
        });
    });

    describe("with the real library", () => {
        it("shows the card and moves through the steps", async () => {
            vi.useRealTimers();
            const real = await vi.importActual<
                typeof import("@/module/onboarding/driverTour")
            >("@/module/onboarding/driverTour");
            startMock.mockImplementation(real.startDriverTour);
            resetStores("dismissed");
            const target = document.createElement("a");
            target.setAttribute("data-tour", "nav-stores");
            target.getBoundingClientRect = () =>
                ({ width: 100, height: 30, top: 0, left: 0 }) as DOMRect;
            target.scrollIntoView = vi.fn();
            document.body.append(target);

            render(<OnboardingTour />);
            act(() => onboardingTourStore.getState().startTour("welcome"));

            const dialog = await screen.findByRole("dialog");
            expect(dialog).toHaveAccessibleName(
                "onboarding.welcome.intro.title"
            );

            fireEvent.click(
                screen.getByRole("button", {
                    name: "onboarding.actions.next",
                })
            );
            expect(onboardingTourStore.getState().stepIndex).toBe(1);

            fireEvent.click(
                screen.getByRole("button", {
                    name: "onboarding.actions.skip",
                })
            );
            expect(screen.queryByRole("dialog")).toBeNull();
            expect(onboardingTourStore.getState().welcomeStatus).toBe(
                "dismissed"
            );
            expect(onboardingTourStore.getState().activeTour).toBeNull();
            target.remove();
        });
    });
});
