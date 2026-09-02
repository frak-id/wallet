import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FlowStep } from "@/module/onboarding/hook/useRegisterFlow";
import { useSkipLatch } from "@/module/onboarding/hook/useSkipLatch";

function SkipButton({
    step,
    onSkip,
    disabled = false,
}: {
    step: FlowStep;
    onSkip: () => void;
    disabled?: boolean;
}) {
    const guardSkip = useSkipLatch(step);
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => guardSkip(onSkip)}
        >
            skip
        </button>
    );
}

function getSkip() {
    return screen.getByRole("button", { name: "skip" });
}

describe("useSkipLatch", () => {
    it("resolves once when double-tapped before the step changes", () => {
        const onSkip = vi.fn();
        render(<SkipButton step="emailInput" onSkip={onSkip} />);

        fireEvent.click(getSkip());
        fireEvent.click(getSkip());

        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it("re-arms when the user returns to the same step", () => {
        const onSkip = vi.fn();
        const { rerender } = render(
            <SkipButton step="emailInput" onSkip={onSkip} />
        );
        fireEvent.click(getSkip());
        expect(onSkip).toHaveBeenCalledTimes(1);

        // Forward to the secure-space step, then back via its back affordance.
        rerender(<SkipButton step="onboardingThree" onSkip={onSkip} />);
        rerender(<SkipButton step="emailInput" onSkip={onSkip} />);

        fireEvent.click(getSkip());
        expect(onSkip).toHaveBeenCalledTimes(2);
    });

    it("re-arms for the next asking step without an intervening screen", () => {
        const onSkip = vi.fn();
        const { rerender } = render(
            <SkipButton step="referralCode" onSkip={onSkip} />
        );
        fireEvent.click(getSkip());

        rerender(<SkipButton step="notification" onSkip={onSkip} />);
        fireEvent.click(getSkip());

        expect(onSkip).toHaveBeenCalledTimes(2);
    });

    it("does not fire while the caller reports the step busy", () => {
        const onSkip = vi.fn();
        render(<SkipButton step="referralCode" onSkip={onSkip} disabled />);

        fireEvent.click(getSkip());

        expect(onSkip).not.toHaveBeenCalled();
    });
});
