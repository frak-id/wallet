import { fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/module/campaigns/hook/useCampaignCurrencyGlyph", () => ({
    useCampaignCurrencyGlyph: () => "€",
}));

import { BudgetCapField, type BudgetFormValues } from "./index";

/**
 * `BudgetCapField` only needs a `Control<BudgetFormValues>` — no
 * `useFormContext`, no store/router/save-campaign plumbing — so a minimal
 * `useForm` harness (mirroring `FormTitle.test.tsx`) is enough to
 * exercise the migrated label/hint/error contract without mocking the rest
 * of the wizard page.
 */
function Harness() {
    const form = useForm<BudgetFormValues>({
        defaultValues: { period: "global", amount: 0 },
        mode: "onChange",
    });

    return (
        <form onSubmit={form.handleSubmit(() => {})}>
            <BudgetCapField control={form.control} />
            <button type="submit">submit</button>
        </form>
    );
}

describe("BudgetCapField (WizardFieldCard label + hint delegated to DS InputNumber)", () => {
    it("associates the DS control's own label to the control (accessible name)", () => {
        render(<Harness />);

        const input = screen.getByLabelText(
            "campaigns.create.budget.cap.label"
        );
        expect(input).toBeInTheDocument();
        const label = screen.getByText("campaigns.create.budget.cap.label");
        expect(label.tagName).toBe("LABEL");
        expect(label).toHaveAttribute("for", input.id);
    });

    it("renders the hint, associated via aria-describedby", () => {
        render(<Harness />);

        expect(
            screen.getByText("campaigns.create.budget.cap.hint")
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText("campaigns.create.budget.cap.label")
        ).toHaveAccessibleDescription("campaigns.create.budget.cap.hint");
    });

    it("renders exactly one label — the DS control's, not a second WizardFieldCard header", () => {
        const { container } = render(<Harness />);

        expect(container.querySelectorAll("label")).toHaveLength(1);
    });

    it("places the hint directly under the control, above the FieldError (intentional reorder)", async () => {
        render(<Harness />);

        const input = screen.getByLabelText(
            "campaigns.create.budget.cap.label"
        );
        // FieldError renders null until there's a message, so trigger the
        // required error, then assert the full DOM order:
        // control → hint → FieldError.
        fireEvent.change(input, { target: { value: "5" } });
        fireEvent.change(input, { target: { value: "" } });
        fireEvent.blur(input);
        fireEvent.click(screen.getByRole("button", { name: "submit" }));
        const error = await screen.findByText(
            "campaigns.create.budget.cap.required"
        );
        const hint = screen.getByText("campaigns.create.budget.cap.hint");

        // input precedes hint
        expect(
            hint.compareDocumentPosition(input) &
                Node.DOCUMENT_POSITION_PRECEDING
        ).toBeTruthy();
        // hint precedes the FieldError message
        expect(
            error.compareDocumentPosition(hint) &
                Node.DOCUMENT_POSITION_PRECEDING
        ).toBeTruthy();
    });

    it("shows the FieldError once the required field is touched and submitted as 0", async () => {
        render(<Harness />);

        const input = screen.getByLabelText(
            "campaigns.create.budget.cap.label"
        );
        // Dirty + touch the field (type then clear to 0) so shouldShowError
        // lets the required-validation error through, then submit.
        fireEvent.change(input, { target: { value: "5" } });
        fireEvent.change(input, { target: { value: "" } });
        fireEvent.blur(input);
        fireEvent.click(screen.getByRole("button", { name: "submit" }));

        expect(
            await screen.findByText("campaigns.create.budget.cap.required")
        ).toBeInTheDocument();
    });
});
