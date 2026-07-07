import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

import { CpaReveal, EligibilityField, LockupField } from "./index";
import { DEFAULT_REWARD_FORM, type RewardFormValues } from "./utils";

/**
 * `EligibilityField`/`LockupField` only need a `Control<RewardFormValues>` —
 * no `useFormContext`, no store/router/save-campaign plumbing — so a minimal
 * `useForm` harness (mirroring `BudgetCapField.test.tsx`, FRA-246) is enough
 * to exercise the migrated label/hint contract without mocking the rest of
 * the wizard page.
 */
function Harness() {
    const form = useForm<RewardFormValues>({
        defaultValues: DEFAULT_REWARD_FORM,
    });

    return (
        <form>
            <EligibilityField control={form.control} />
            <LockupField control={form.control} />
        </form>
    );
}

/**
 * `CpaReveal` (the Target-CPA field) also only needs `control` + `setValue`
 * from `useForm` — no store/router/save-campaign plumbing — so the same
 * minimal harness shape covers it. `useCurrencyGlyph` reads a context with a
 * `"\u20ac"` default, so no provider is required.
 */
function CpaRevealHarness() {
    const form = useForm<RewardFormValues>({
        defaultValues: DEFAULT_REWARD_FORM,
    });

    return (
        <form>
            <CpaReveal
                control={form.control}
                setValue={form.setValue}
                unit="amount"
                cpaName="targetCpa"
                ambName="ambassadorAmount"
                refName="refereeAmount"
                cpaLabel="campaigns.create.reward.fixed.cpaLabel"
                cpaPlaceholder="campaigns.create.reward.fixed.cpaPlaceholder"
                ambPlaceholder="campaigns.create.reward.recipient.ambassadorPlaceholder"
                refPlaceholder="campaigns.create.reward.recipient.refereePlaceholder"
                recipientHint={() =>
                    "campaigns.create.reward.fixed.percentOfPool"
                }
            />
        </form>
    );
}

describe("CpaReveal Target-CPA field (FRA-246 — StepperField label/hint passthrough)", () => {
    it("associates the DS control's own label to the control (accessible name)", () => {
        render(<CpaRevealHarness />);

        const input = screen.getByLabelText(
            "campaigns.create.reward.fixed.cpaLabel"
        );
        expect(input).toBeInTheDocument();
        const label = screen.getByText(
            "campaigns.create.reward.fixed.cpaLabel"
        );
        expect(label.tagName).toBe("LABEL");
        expect(label).toHaveAttribute("for", input.id);
    });

    it("renders the hint, associated via aria-describedby", () => {
        render(<CpaRevealHarness />);

        expect(
            screen.getByText("campaigns.create.reward.cpa.hint")
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText("campaigns.create.reward.fixed.cpaLabel")
        ).toHaveAccessibleDescription("campaigns.create.reward.cpa.hint");
    });
});

describe("EligibilityField (FRA-246 — StepperField label/hint passthrough)", () => {
    it("associates the DS control's own label to the control (accessible name)", () => {
        render(<Harness />);

        const input = screen.getByLabelText(
            "campaigns.create.reward.eligibility.minPurchaseLabel"
        );
        expect(input).toBeInTheDocument();
        const label = screen.getByText(
            "campaigns.create.reward.eligibility.minPurchaseLabel"
        );
        expect(label.tagName).toBe("LABEL");
        expect(label).toHaveAttribute("for", input.id);
    });

    it("renders the hint, associated via aria-describedby", () => {
        render(<Harness />);

        expect(
            screen.getByText(
                "campaigns.create.reward.eligibility.minPurchaseHint"
            )
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText(
                "campaigns.create.reward.eligibility.minPurchaseLabel"
            )
        ).toHaveAccessibleDescription(
            "campaigns.create.reward.eligibility.minPurchaseHint"
        );
    });
});

describe("LockupField (FRA-246 — StepperField label/hint passthrough)", () => {
    it("associates the DS control's own label to the control (accessible name)", () => {
        render(<Harness />);

        const input = screen.getByLabelText(
            "campaigns.create.reward.lockup.durationLabel"
        );
        expect(input).toBeInTheDocument();
        const label = screen.getByText(
            "campaigns.create.reward.lockup.durationLabel"
        );
        expect(label.tagName).toBe("LABEL");
        expect(label).toHaveAttribute("for", input.id);
    });

    it("renders the hint, associated via aria-describedby", () => {
        render(<Harness />);

        expect(
            screen.getByText("campaigns.create.reward.lockup.durationHint")
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText(
                "campaigns.create.reward.lockup.durationLabel"
            )
        ).toHaveAccessibleDescription(
            "campaigns.create.reward.lockup.durationHint"
        );
    });

    it("still renders the InfoBanner above the field (outer Stack untouched)", () => {
        render(<Harness />);

        expect(
            screen.getByText("campaigns.create.reward.lockup.info")
        ).toBeInTheDocument();
    });
});
