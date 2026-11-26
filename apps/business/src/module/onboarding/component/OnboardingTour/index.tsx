import { Button } from "@frak-labs/design-system/components/Button";
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
} from "@frak-labs/design-system/components/Popover";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useLocation } from "@tanstack/react-router";
import {
    type KeyboardEvent,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useIsBareShell } from "@/module/common/hook/useIsBareShell";
import {
    canAutoStartOn,
    type TourStep,
    useTours,
} from "@/module/onboarding/tours";
import { onboardingTourStore, type TourId } from "@/stores/onboardingTourStore";
import { welcomePopupStore } from "@/stores/welcomePopupStore";
import * as styles from "./onboarding-tour.css";

const AUTO_START_DELAY_MS = 500;
const TARGET_RETRY_DELAYS_MS = [0, 300, 900];

function prefersReducedMotion(): boolean {
    return (
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

function findVisibleTarget(name?: string): HTMLElement | null {
    if (!name) return null;
    const nodes = document.querySelectorAll<HTMLElement>(
        `[data-tour="${name}"]`
    );
    for (const node of nodes) {
        const { width, height } = node.getBoundingClientRect();
        if (width > 0 && height > 0) return node;
    }
    return null;
}

/** The element a step points at. Pages load data late, so look a few times. */
function useTargetElement(name?: string): HTMLElement | null {
    const [element, setElement] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setElement(null);
        if (!name) return;
        let isFound = false;
        const timers = TARGET_RETRY_DELAYS_MS.map((delay) =>
            window.setTimeout(() => {
                if (isFound) return;
                const found = findVisibleTarget(name);
                if (!found) return;
                isFound = true;
                found.scrollIntoView({
                    block: "nearest",
                    inline: "nearest",
                    behavior: prefersReducedMotion() ? "auto" : "smooth",
                });
                setElement(found);
            }, delay)
        );
        return () => {
            for (const timer of timers) window.clearTimeout(timer);
        };
    }, [name]);

    return element;
}

function useElementRect(element: HTMLElement | null): DOMRect | null {
    const [rect, setRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (!element) {
            setRect(null);
            return;
        }
        const update = () => setRect(element.getBoundingClientRect());
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
        };
    }, [element]);

    return rect;
}

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

function TourRunner({ tourId }: { tourId: TourId }) {
    const steps = useTours()[tourId];
    const stepIndex = onboardingTourStore((s) => s.stepIndex);
    const setStep = onboardingTourStore((s) => s.setStep);
    const closeTour = onboardingTourStore((s) => s.closeTour);
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

    const index = Math.min(stepIndex, steps.length - 1);
    const step = steps[index];
    const isLast = index === steps.length - 1;

    return (
        <TourCard
            tourId={tourId}
            step={step}
            index={index}
            total={steps.length}
            onBack={() => setStep(Math.max(index - 1, 0))}
            onNext={() =>
                isLast ? closeTour("completed") : setStep(index + 1)
            }
            onClose={() => closeTour("dismissed")}
        />
    );
}

type TourCardProps = {
    tourId: TourId;
    step: TourStep;
    index: number;
    total: number;
    onBack: () => void;
    onNext: () => void;
    onClose: () => void;
};

function TourCard({
    tourId,
    step,
    index,
    total,
    onBack,
    onNext,
    onClose,
}: TourCardProps) {
    const { t } = useTranslation();
    const startTour = onboardingTourStore((s) => s.startTour);
    const titleId = useId();
    const bodyId = useId();
    const cardRef = useRef<HTMLDivElement>(null);
    const target = useTargetElement(step.target);
    const rect = useElementRect(target);
    const isLast = index === total - 1;
    const isWelcome = tourId === "welcome";

    const virtualAnchor = useMemo(
        () =>
            target
                ? {
                      current: {
                          getBoundingClientRect: () =>
                              target.getBoundingClientRect(),
                      },
                  }
                : null,
        [target]
    );

    // Each step moves focus to the card so a screen reader announces it.
    useEffect(() => {
        cardRef.current?.focus({ preventScroll: true });
    }, [step.id]);

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === "ArrowRight") {
            event.preventDefault();
            onNext();
        } else if (event.key === "ArrowLeft" && index > 0) {
            event.preventDefault();
            onBack();
        }
    };

    return (
        <Popover open modal={false}>
            {virtualAnchor ? (
                <PopoverAnchor virtualRef={virtualAnchor} />
            ) : (
                <PopoverAnchor asChild>
                    <div className={styles.centerAnchor} aria-hidden="true" />
                </PopoverAnchor>
            )}
            {rect &&
                createPortal(
                    <div
                        aria-hidden="true"
                        className={styles.highlight}
                        style={{
                            top: rect.top,
                            left: rect.left,
                            width: rect.width,
                            height: rect.height,
                        }}
                    />,
                    document.body
                )}
            <PopoverContent
                ref={cardRef}
                className={styles.card}
                side={virtualAnchor ? (step.side ?? "bottom") : "bottom"}
                sideOffset={16}
                collisionPadding={16}
                aria-labelledby={titleId}
                aria-describedby={bodyId}
                tabIndex={-1}
                onKeyDown={onKeyDown}
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    cardRef.current?.focus({ preventScroll: true });
                }}
                onCloseAutoFocus={(event) => event.preventDefault()}
                onEscapeKeyDown={onClose}
                onInteractOutside={(event) => event.preventDefault()}
            >
                <Stack space="m">
                    <Stack space="xs">
                        <Text variant="caption" color="secondary">
                            {t("onboarding.progress", {
                                current: index + 1,
                                total,
                            })}
                        </Text>
                        <Text
                            as="h2"
                            id={titleId}
                            variant="heading5"
                            color="primary"
                        >
                            {step.title}
                        </Text>
                        <Text id={bodyId} variant="bodySmall" color="secondary">
                            {step.body}
                        </Text>
                    </Stack>
                    <div className={styles.footer}>
                        <Stack space="xs">
                            {!isLast && (
                                <Button
                                    variant="ghost"
                                    size="small"
                                    width="auto"
                                    onClick={onClose}
                                >
                                    {t(
                                        isWelcome
                                            ? "onboarding.actions.skip"
                                            : "onboarding.actions.close"
                                    )}
                                </Button>
                            )}
                            {!isWelcome && index === 0 && (
                                <Button
                                    variant="ghost"
                                    size="small"
                                    width="auto"
                                    onClick={() => startTour("welcome")}
                                >
                                    {t("onboarding.actions.fullTour")}
                                </Button>
                            )}
                        </Stack>
                        <div className={styles.footer}>
                            {index > 0 && (
                                <Button
                                    variant="secondary"
                                    size="small"
                                    width="auto"
                                    onClick={onBack}
                                >
                                    {t("onboarding.actions.back")}
                                </Button>
                            )}
                            <Button
                                variant="primary"
                                size="small"
                                width="auto"
                                onClick={onNext}
                            >
                                {t(
                                    isLast
                                        ? "onboarding.actions.done"
                                        : "onboarding.actions.next"
                                )}
                            </Button>
                        </div>
                    </div>
                </Stack>
            </PopoverContent>
        </Popover>
    );
}
