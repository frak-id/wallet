import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WizardFieldCard } from "./index";

describe("WizardFieldCard (FRA-246/U6 — optional label)", () => {
    it("renders no header when label is omitted, but still renders the card + children", () => {
        const { container } = render(
            <WizardFieldCard>
                <input aria-label="field" />
            </WizardFieldCard>
        );

        expect(screen.getByLabelText("field")).toBeInTheDocument();
        // No stray label/description text node anywhere in the card.
        expect(container.querySelector("p")).toBeNull();
    });

    it("renders the label (+ description) when provided", () => {
        render(
            <WizardFieldCard
                label="Section title"
                description="Section description"
            >
                <input aria-label="field" />
            </WizardFieldCard>
        );

        expect(screen.getByText("Section title")).toBeInTheDocument();
        expect(screen.getByText("Section description")).toBeInTheDocument();
        expect(screen.getByLabelText("field")).toBeInTheDocument();
    });

    it("renders the label without a description when description is omitted", () => {
        render(
            <WizardFieldCard label="Section title">
                <input aria-label="field" />
            </WizardFieldCard>
        );

        expect(screen.getByText("Section title")).toBeInTheDocument();
    });
});
