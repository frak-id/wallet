import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type StartTourOptions, startDriverTour } from "./driverTour";

const labels = {
    next: "Next",
    back: "Back",
    done: "Done",
    close: "Close tour",
    skip: "Skip tour",
    fullTour: "Show the full tour",
    progress: (current: number, total: number) => `Step ${current} of ${total}`,
};

const steps = [
    { id: "a", title: "First <b>step</b>", body: "Body one" },
    { id: "b", target: "target", title: "Second step", body: "Body two" },
    { id: "c", title: "Third step", body: "Body three" },
];

const mountTarget = () => {
    const target = document.createElement("button");
    target.setAttribute("data-tour", "target");
    target.getBoundingClientRect = () =>
        ({
            top: 10,
            left: 20,
            width: 100,
            height: 30,
            right: 120,
            bottom: 40,
            x: 20,
            y: 10,
            toJSON: () => ({}),
        }) as DOMRect;
    target.scrollIntoView = vi.fn();
    document.body.append(target);
    return target;
};

const press = (key: string) => {
    const target = document.activeElement ?? document.body;
    fireEvent.keyDown(target, { key });
    fireEvent.keyUp(target, { key });
};

const settle = () =>
    act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
    });

const setReducedMotion = (matches: boolean) =>
    vi
        .spyOn(window, "matchMedia")
        .mockImplementation(
            (query) => ({ matches, media: query }) as MediaQueryList
        );

describe("startDriverTour", () => {
    let options: StartTourOptions;
    let stop: (() => void) | undefined;

    const start = async (overrides: Partial<StartTourOptions> = {}) => {
        options = {
            steps,
            labels,
            startIndex: 0,
            canSkip: true,
            canOpenFullTour: false,
            onStep: vi.fn(),
            onEnd: vi.fn(),
            onOpenFullTour: vi.fn(),
            ...overrides,
        };
        stop = await startDriverTour(options);
    };

    beforeEach(() => {
        mountTarget();
    });

    afterEach(() => {
        stop?.();
        stop = undefined;
        vi.restoreAllMocks();
        vi.useRealTimers();
        document.body.innerHTML = "";
    });

    describe("card", () => {
        it("is a dialog named by its title and described by its text", async () => {
            await start();

            const dialog = screen.getByRole("dialog");
            expect(dialog).toHaveAccessibleName("First <b>step</b>");
            expect(dialog).toHaveAccessibleDescription("Body one");
            expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
        });

        it("shows the copy as text, never as HTML", async () => {
            await start();

            expect(
                screen.getByRole("dialog").querySelector("b")
            ).not.toBeInTheDocument();
        });

        it("moves the keyboard to the Next button", async () => {
            await start();

            expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
        });

        it("labels the close button for screen readers", async () => {
            await start();

            expect(
                screen.getByRole("button", { name: "Close tour" })
            ).toBeInTheDocument();
        });

        it("can open on a later step", async () => {
            await start({ startIndex: 2 });

            expect(screen.getByRole("dialog")).toHaveAccessibleName(
                "Third step"
            );
            expect(
                screen.getByRole("button", { name: "Done" })
            ).toBeInTheDocument();
        });
    });

    describe("target", () => {
        it("highlights the element a step points at", async () => {
            await start({ startIndex: 1 });

            expect(document.querySelector('[data-tour="target"]')).toHaveClass(
                "driver-active-element"
            );
        });

        it("centers the card when the target never shows up", async () => {
            document.querySelector('[data-tour="target"]')?.remove();
            vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
            await start({ startIndex: 1 });
            await act(async () => {
                await vi.advanceTimersByTimeAsync(2000);
            });

            expect(screen.getByRole("dialog")).toHaveAccessibleName(
                "Second step"
            );
        });

        it("skips hidden copies of the same target", async () => {
            const hidden = document.createElement("a");
            hidden.setAttribute("data-tour", "target");
            document.body.prepend(hidden);
            await start({ startIndex: 1 });

            expect(hidden).not.toHaveClass("driver-active-element");
            expect(
                document.querySelector('button[data-tour="target"]')
            ).toHaveClass("driver-active-element");
        });
    });

    describe("navigation", () => {
        it("goes forward and back with the buttons", async () => {
            await start();

            fireEvent.click(screen.getByRole("button", { name: "Next" }));
            expect(screen.getByRole("dialog")).toHaveAccessibleName(
                "Second step"
            );
            expect(options.onStep).toHaveBeenLastCalledWith(1);

            fireEvent.click(screen.getByRole("button", { name: "Back" }));
            expect(screen.getByRole("dialog")).toHaveAccessibleName(
                "First <b>step</b>"
            );
            expect(options.onStep).toHaveBeenLastCalledWith(0);
        });

        it("goes forward and back with the arrow keys", async () => {
            setReducedMotion(true);
            await start();
            await settle();

            press("ArrowRight");
            await waitFor(() =>
                expect(screen.getByRole("dialog")).toHaveAccessibleName(
                    "Second step"
                )
            );

            await settle();
            press("ArrowLeft");
            await waitFor(() =>
                expect(screen.getByRole("dialog")).toHaveAccessibleName(
                    "First <b>step</b>"
                )
            );
        });
    });

    describe("ending", () => {
        it("reports a dismissal on Escape", async () => {
            await start();
            await settle();

            press("Escape");

            expect(options.onEnd).toHaveBeenCalledWith("dismissed");
            expect(screen.queryByRole("dialog")).toBeNull();
        });

        it("reports a dismissal on the close button", async () => {
            await start();

            fireEvent.click(screen.getByRole("button", { name: "Close tour" }));

            expect(options.onEnd).toHaveBeenCalledWith("dismissed");
        });

        it("keeps the tour open when the page behind the card is clicked", async () => {
            await start();

            fireEvent.click(document.body);

            expect(screen.getByRole("dialog")).toBeInTheDocument();
            expect(options.onEnd).not.toHaveBeenCalled();
        });

        it("reports completion on the last step", async () => {
            await start({ startIndex: 2 });

            fireEvent.click(screen.getByRole("button", { name: "Done" }));

            expect(options.onEnd).toHaveBeenCalledTimes(1);
            expect(options.onEnd).toHaveBeenCalledWith("completed");
        });

        it("does not open a tour cancelled while driver.js was loading", async () => {
            const controller = new AbortController();
            controller.abort();
            await start({ signal: controller.signal });

            expect(screen.queryByRole("dialog")).toBeNull();
            expect(options.onEnd).not.toHaveBeenCalled();
        });

        it("keeps a newer tour open when an older one is cancelled while loading", async () => {
            const older = new AbortController();
            const olderEnd = vi.fn();
            const olderTour = startDriverTour({
                steps,
                labels,
                startIndex: 0,
                canSkip: true,
                canOpenFullTour: false,
                onStep: vi.fn(),
                onEnd: olderEnd,
                onOpenFullTour: vi.fn(),
                signal: older.signal,
            });
            older.abort();
            await start();
            await olderTour;
            await settle();

            expect(screen.getByRole("dialog")).toBeInTheDocument();
            expect(olderEnd).not.toHaveBeenCalled();
            expect(options.onEnd).not.toHaveBeenCalled();
        });

        it("does not report anything when another tour replaces it", async () => {
            await start();
            const replaced = options;
            const stopReplaced = stop;
            await start({ startIndex: 2 });
            stopReplaced?.();

            expect(replaced.onEnd).not.toHaveBeenCalled();
            expect(screen.getByRole("dialog")).toHaveAccessibleName(
                "Third step"
            );
        });

        it("does not report anything when it is stopped from code", async () => {
            await start();

            stop?.();

            expect(screen.queryByRole("dialog")).toBeNull();
            expect(options.onEnd).not.toHaveBeenCalled();
        });
    });

    describe("extra links", () => {
        it("skips the tour from any step but the last", async () => {
            await start();

            fireEvent.click(screen.getByRole("button", { name: "Skip tour" }));

            expect(options.onEnd).toHaveBeenCalledWith("dismissed");
            expect(screen.queryByRole("dialog")).toBeNull();
        });

        it("hides Skip on the last step", async () => {
            await start({ startIndex: 2 });

            expect(
                screen.queryByRole("button", { name: "Skip tour" })
            ).toBeNull();
        });

        it("hides Skip when the tour cannot be skipped", async () => {
            await start({ canSkip: false });

            expect(
                screen.queryByRole("button", { name: "Skip tour" })
            ).toBeNull();
        });

        it("offers the full tour on the first step of a page tour only", async () => {
            await start({ canSkip: false, canOpenFullTour: true });

            fireEvent.click(
                screen.getByRole("button", { name: "Show the full tour" })
            );
            expect(options.onOpenFullTour).toHaveBeenCalledTimes(1);

            fireEvent.click(screen.getByRole("button", { name: "Next" }));
            expect(
                screen.queryByRole("button", { name: "Show the full tour" })
            ).toBeNull();
        });
    });

    describe("motion", () => {
        it("animates by default", async () => {
            setReducedMotion(false);
            await start();

            expect(document.body).toHaveClass("driver-fade");
        });

        it("does not animate when the user prefers reduced motion", async () => {
            setReducedMotion(true);
            await start();

            expect(document.body).toHaveClass("driver-simple");
            expect(document.body).not.toHaveClass("driver-fade");
        });
    });
});
