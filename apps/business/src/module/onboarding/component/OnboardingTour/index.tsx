import { useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useIsBareShell } from "@/module/common/hook/useIsBareShell";
import {
    startDriverTour,
    type TourLabels,
} from "@/module/onboarding/driverTour";
import { canAutoStartOn, useTours } from "@/module/onboarding/tours";
import { onboardingTourStore, type TourId } from "@/stores/onboardingTourStore";
import { welcomePopupStore } from "@/stores/welcomePopupStore";

const AUTO_START_DELAY_MS = 500;

/** Starts the welcome tour once, for a user who has not seen it yet. */
function useAutoStartWelcomeTour() {
    const { pathname } = useLocation();
    const isDemoMode = useIsDemoMode();
    const isBare = useIsBareShell();
    const welcomeStatus = onboardingTourStore((s) => s.welcomeStatus);
    const activeTour = onboardingTourStore((s) => s.activeTour);
    const startTour = onboardingTourStore((s) => s.startTour);
    const hasSeenAnnouncement = welcomePopupStore((s) => s.hasSeenWelcome);

    const canStart =
        welcomeStatus === "pending" &&
        !activeTour &&
        hasSeenAnnouncement &&
        !isDemoMode &&
        !isBare &&
        canAutoStartOn(pathname);

    useEffect(() => {
        if (!canStart) return;
        const timer = window.setTimeout(
            () => startTour("welcome"),
            AUTO_START_DELAY_MS
        );
        return () => window.clearTimeout(timer);
    }, [canStart, startTour]);
}

export function OnboardingTour() {
    useAutoStartWelcomeTour();
    const activeTour = onboardingTourStore((s) => s.activeTour);
    if (!activeTour) return null;
    return <TourRunner key={activeTour} tourId={activeTour} />;
}

function useTourLabels(): TourLabels {
    const { t } = useTranslation();
    return useMemo(
        () => ({
            next: t("onboarding.actions.next"),
            back: t("onboarding.actions.back"),
            done: t("onboarding.actions.done"),
            close: t("onboarding.actions.close"),
            skip: t("onboarding.actions.skip"),
            fullTour: t("onboarding.actions.fullTour"),
            progress: (current, total) =>
                t("onboarding.progress", { current, total }),
        }),
        [t]
    );
}

/** Runs one tour with driver.js and mirrors its step and outcome in the store. */
function TourRunner({ tourId }: { tourId: TourId }) {
    const steps = useTours()[tourId];
    const labels = useTourLabels();
    const setStep = onboardingTourStore((s) => s.setStep);
    const closeTour = onboardingTourStore((s) => s.closeTour);
    const abortTour = onboardingTourStore((s) => s.abortTour);
    const startTour = onboardingTourStore((s) => s.startTour);
    const { pathname } = useLocation();
    const openedOnPath = useRef(pathname);

    useEffect(() => {
        const previouslyFocused = document.activeElement;
        return () => {
            if (
                previouslyFocused instanceof HTMLElement &&
                document.contains(previouslyFocused)
            ) {
                previouslyFocused.focus({ preventScroll: true });
            }
        };
    }, []);

    useEffect(() => {
        if (pathname !== openedOnPath.current) closeTour("dismissed");
    }, [pathname, closeTour]);

    useEffect(() => {
        let isCancelled = false;
        let stop: (() => void) | undefined;
        startDriverTour({
            steps,
            labels,
            startIndex: Math.min(
                onboardingTourStore.getState().stepIndex,
                steps.length - 1
            ),
            canSkip: tourId === "welcome",
            canOpenFullTour: tourId !== "welcome",
            onStep: setStep,
            onEnd: closeTour,
            onOpenFullTour: () => startTour("welcome"),
        })
            .then((stopTour) => {
                if (isCancelled) stopTour();
                else stop = stopTour;
            })
            .catch(() => {
                if (!isCancelled) abortTour();
            });
        return () => {
            isCancelled = true;
            stop?.();
        };
    }, [tourId, steps, labels, setStep, closeTour, abortTour, startTour]);

    return null;
}
