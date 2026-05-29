import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Stepper, type StepperStep } from ".";

const steps: StepperStep[] = [
    { title: "Campaign basics", description: "Name, merchant & currency" },
    { title: "Goals", description: "What action triggers rewards" },
    {
        title: "Territory & categories",
        description: "Countries & Ad categories",
    },
];

describe("Stepper", () => {
    it("renders every step title and description", () => {
        const { getByText } = render(<Stepper steps={steps} activeStep={0} />);
        for (const s of steps) {
            expect(getByText(s.title)).toBeTruthy();
            if (s.description) expect(getByText(s.description)).toBeTruthy();
        }
    });

    it("marks the active step with aria-current", () => {
        const { getByLabelText } = render(
            <Stepper steps={steps} activeStep={1} />
        );
        const active = getByLabelText(/Goals, current/);
        expect(active.getAttribute("aria-current")).toBe("step");
    });

    it("labels steps before the active one as completed", () => {
        const { getByLabelText } = render(
            <Stepper steps={steps} activeStep={2} />
        );
        expect(getByLabelText(/Campaign basics, completed/)).toBeTruthy();
        expect(getByLabelText(/Goals, completed/)).toBeTruthy();
    });

    it("labels steps after the active one as upcoming", () => {
        const { getByLabelText } = render(
            <Stepper steps={steps} activeStep={0} />
        );
        expect(getByLabelText(/Goals, upcoming/)).toBeTruthy();
    });

    it("makes completed steps clickable when onStepClick is provided", () => {
        const onStepClick = vi.fn();
        const { getByLabelText } = render(
            <Stepper steps={steps} activeStep={2} onStepClick={onStepClick} />
        );
        const completed = getByLabelText(/Campaign basics, completed/);
        expect(completed.tagName).toBe("BUTTON");
        fireEvent.click(completed);
        expect(onStepClick).toHaveBeenCalledWith(0);
    });

    it("does not make the active step clickable", () => {
        const onStepClick = vi.fn();
        const { getByLabelText } = render(
            <Stepper steps={steps} activeStep={1} onStepClick={onStepClick} />
        );
        const active = getByLabelText(/Goals, current/);
        expect(active.tagName).not.toBe("BUTTON");
    });

    it("forwards className to the root list", () => {
        const { container } = render(
            <Stepper steps={steps} activeStep={0} className="custom" />
        );
        expect(container.querySelector("ol.custom")).toBeTruthy();
    });
});
