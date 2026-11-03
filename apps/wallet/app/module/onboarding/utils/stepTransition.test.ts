import { afterEach, describe, expect, it, vi } from "vitest";
import { withStepTransition } from "./stepTransition";

function skippedTransition() {
    return {
        ready: Promise.reject(
            new DOMException("Transition was skipped", "AbortError")
        ),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        skipTransition: vi.fn(),
    };
}

describe("withStepTransition", () => {
    afterEach(() => {
        Reflect.deleteProperty(document, "startViewTransition");
        document.documentElement.removeAttribute("data-onboarding-transition");
    });

    it("applies the update and swallows the abort when a newer transition skips it", async () => {
        const update = vi.fn();
        const unhandled = vi.fn();
        process.on("unhandledRejection", unhandled);
        Object.assign(document, {
            startViewTransition: (cb: () => void) => {
                cb();
                return skippedTransition();
            },
        });

        withStepTransition("forward", update);
        await new Promise((resolve) => setTimeout(resolve, 0));
        process.off("unhandledRejection", unhandled);

        expect(update).toHaveBeenCalledOnce();
        expect(unhandled).not.toHaveBeenCalled();
        expect(
            document.documentElement.hasAttribute("data-onboarding-transition")
        ).toBe(false);
    });

    it("updates synchronously without the View Transitions API", () => {
        const update = vi.fn();

        withStepTransition("backward", update);

        expect(update).toHaveBeenCalledOnce();
    });
});
