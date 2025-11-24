import { Accordion } from "@frak-labs/ui/component/Accordion";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccordionRecoveryItem } from "./index";

const mockRecoveryStore = vi.fn();

vi.mock("@/module/stores/recoveryStore", () => ({
    recoveryStore: (selector: any) => mockRecoveryStore(selector),
    selectRecoveryStep: (state: any) => state.step,
}));

describe("AccordionRecoveryItem", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render with title and children", () => {
        mockRecoveryStore.mockReturnValue(1);

        const { container } = render(
            <Accordion type="single" collapsible value="step-1">
                <AccordionRecoveryItem actualStep={1} title="Test Step">
                    <div>Step content</div>
                </AccordionRecoveryItem>
            </Accordion>
        );

        expect(screen.getByText("1. Test Step")).toBeInTheDocument();
        // AccordionContent is rendered but may be hidden - check in DOM
        expect(container.textContent).toContain("Step content");
    });

    it("should show done status when step is completed", () => {
        mockRecoveryStore.mockReturnValue(2);

        render(
            <Accordion type="single" collapsible>
                <AccordionRecoveryItem actualStep={1} title="Completed Step">
                    <div>Content</div>
                </AccordionRecoveryItem>
            </Accordion>
        );

        const trigger = screen.getByText("1. Completed Step").closest("button");
        expect(trigger).toBeDisabled();
    });

    it("should show pending status when step is not reached", () => {
        mockRecoveryStore.mockReturnValue(1);

        render(
            <Accordion type="single" collapsible>
                <AccordionRecoveryItem actualStep={3} title="Pending Step">
                    <div>Content</div>
                </AccordionRecoveryItem>
            </Accordion>
        );

        const trigger = screen.getByText("3. Pending Step").closest("button");
        expect(trigger).toBeDisabled();
    });

    it("should show in-progress status when step matches current step", () => {
        mockRecoveryStore.mockReturnValue(2);

        render(
            <Accordion type="single" collapsible>
                <AccordionRecoveryItem actualStep={2} title="Current Step">
                    <div>Content</div>
                </AccordionRecoveryItem>
            </Accordion>
        );

        const trigger = screen.getByText("2. Current Step").closest("button");
        expect(trigger).not.toBeDisabled();
    });
});
