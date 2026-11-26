import type { Driver, DriveStep, PopoverDOM } from "driver.js";
import * as styles from "./component/OnboardingTour/onboarding-tour.css";
import type { TourStep } from "./tours";

/** A step's target can mount late: pages load their data first. */
const TARGET_WAIT_MS = 1500;

export type TourLabels = {
    next: string;
    back: string;
    done: string;
    close: string;
    skip: string;
    fullTour: string;
    progress: (current: number, total: number) => string;
};

export type TourOutcome = "completed" | "dismissed";

export type StartTourOptions = {
    steps: TourStep[];
    labels: TourLabels;
    startIndex: number;
    /** Welcome tour: show a "Skip" link on every step but the last. */
    canSkip: boolean;
    /** Page tour: show a "Show the full tour" link on the first step. */
    canOpenFullTour: boolean;
    onStep: (index: number) => void;
    onEnd: (outcome: TourOutcome) => void;
    onOpenFullTour: () => void;
};

export function prefersReducedMotion(): boolean {
    return (
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

export function findVisibleTarget(name: string): HTMLElement | null {
    const nodes = document.querySelectorAll<HTMLElement>(
        `[data-tour="${name}"]`
    );
    for (const node of nodes) {
        const { width, height } = node.getBoundingClientRect();
        if (width > 0 && height > 0) return node;
    }
    return null;
}

function toDriveStep(
    step: TourStep,
    index: number,
    total: number,
    labels: TourLabels
): DriveStep {
    const { target } = step;
    return {
        // driver.js treats a falsy result as "not on the page" and centers the card.
        element: target
            ? () => findVisibleTarget(target) as Element
            : undefined,
        waitForElement: target ? TARGET_WAIT_MS : undefined,
        popover: {
            title: step.title,
            description: step.body,
            side: step.side ?? "bottom",
            align: "start",
            progressText: labels.progress(index + 1, total),
        },
    };
}

function createLink(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = styles.link;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
}

/** Text is set as text, never as HTML, so a "<" in the copy cannot break the card. */
function fillPopover(popover: PopoverDOM, step: TourStep) {
    popover.title.textContent = step.title;
    popover.description.textContent = step.body;
}

/**
 * Starts a tour with driver.js (loaded on first use) and returns a function
 * that stops it. `onEnd` only fires when the user ends the tour, not when the
 * returned function is called.
 */
export async function startDriverTour(
    options: StartTourOptions
): Promise<() => void> {
    const { steps, labels } = options;
    const [{ driver }] = await Promise.all([
        import("driver.js"),
        import("driver.js/dist/driver.css"),
    ]);

    const isReducedMotion = prefersReducedMotion();
    let isStopped = false;

    const finish = (outcome: TourOutcome) => {
        if (isStopped) return;
        isStopped = true;
        options.onEnd(outcome);
        tour.destroy();
    };

    const tour: Driver = driver({
        popoverClass: styles.popover,
        animate: !isReducedMotion,
        smoothScroll: !isReducedMotion,
        overlayOpacity: 0.5,
        stagePadding: 6,
        // A click next to the card must not end a tour the user may want to keep.
        overlayClickBehavior: "none",
        showProgress: true,
        nextBtnText: labels.next,
        prevBtnText: labels.back,
        doneBtnText: labels.done,
        closeBtnLabel: labels.close,
        steps: steps.map((step, index) =>
            toDriveStep(step, index, steps.length, labels)
        ),
        onHighlightStarted: (_element, _step, { index }) => {
            if (index !== undefined) options.onStep(index);
        },
        onPopoverRender: (popover, { index }) => {
            const stepIndex = index ?? 0;
            const step = steps[stepIndex];
            if (!step) return;
            fillPopover(popover, step);

            const isLast = stepIndex === steps.length - 1;
            const links: HTMLButtonElement[] = [];
            if (options.canSkip && !isLast) {
                links.push(createLink(labels.skip, () => finish("dismissed")));
            }
            if (options.canOpenFullTour && stepIndex === 0) {
                links.push(createLink(labels.fullTour, options.onOpenFullTour));
            }
            if (links.length === 0) return;
            const row = document.createElement("div");
            row.className = styles.extras;
            row.append(...links);
            popover.wrapper.append(row);
        },
        onDestroyed: (_element, _step, { reason }) => {
            if (isStopped) return;
            isStopped = true;
            options.onEnd(reason === "done" ? "completed" : "dismissed");
        },
    });
    tour.drive(options.startIndex);

    return () => {
        if (isStopped) return;
        isStopped = true;
        tour.destroy();
    };
}
