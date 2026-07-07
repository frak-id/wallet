import { fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { Form } from "@/module/forms/Form";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

import { FormTitle } from "./FormTitle";

/**
 * `FormTitle` reads its form via `useFormContext<CampaignDraft>()`, but
 * react-hook-form's context is untyped at runtime — a minimal `{ name }`
 * form wired through the same `Form`/`FormProvider` satisfies it exactly like
 * `EditField.test.tsx`'s harness (FRA-246/U5/U6).
 */
function Harness() {
    const form = useForm({ defaultValues: { name: "" }, mode: "onSubmit" });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(() => {})}>
                <FormTitle />
                <button type="submit">submit</button>
            </form>
        </Form>
    );
}

describe("FormTitle (FRA-246/U6 — WizardFieldCard label delegated to DS Input)", () => {
    it("associates the DS control's own label to the control (accessible name)", () => {
        render(<Harness />);

        const input = screen.getByLabelText(
            "campaigns.create.basics.title.label"
        );
        expect(input).toBeInTheDocument();
        const label = screen.getByText("campaigns.create.basics.title.label");
        expect(label.tagName).toBe("LABEL");
        expect(label).toHaveAttribute("for", input.id);
    });

    it("renders the hint, associated via aria-describedby", () => {
        render(<Harness />);

        expect(
            screen.getByText("campaigns.create.basics.title.hint")
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText("campaigns.create.basics.title.label")
        ).toHaveAccessibleDescription("campaigns.create.basics.title.hint");
    });

    it("renders exactly one label — the DS control's, not a second WizardFieldCard header", () => {
        const { container } = render(<Harness />);

        expect(container.querySelectorAll("label")).toHaveLength(1);
    });

    it("shows the FieldError once the required field is touched and submitted empty", async () => {
        render(<Harness />);

        const input = screen.getByLabelText(
            "campaigns.create.basics.title.label"
        );
        // Dirty + touch the field (type then clear) so the wizard's
        // "don't nag a pristine field" gate (shouldShowError) lets the error
        // through, then submit.
        fireEvent.change(input, { target: { value: "a" } });
        fireEvent.change(input, { target: { value: "" } });
        fireEvent.blur(input);
        fireEvent.click(screen.getByRole("button", { name: "submit" }));

        expect(
            await screen.findByText("campaigns.create.basics.title.required")
        ).toBeInTheDocument();
    });
});
