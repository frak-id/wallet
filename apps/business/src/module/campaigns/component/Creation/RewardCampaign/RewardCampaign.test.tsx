import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

import * as rows from "../wizardRows.css";
import {
    CpaReveal,
    EligibilityField,
    LockupField,
    RecipientBox,
    RewardBasisField,
    TierField,
} from "./index";
import * as styles from "./reward.css";
import { DEFAULT_REWARD_FORM, type RewardFormValues } from "./utils";

/**
 * `EligibilityField`/`LockupField` only need a `Control<RewardFormValues>` —
 * no `useFormContext`, no store/router/save-campaign plumbing — so a minimal
 * `useForm` harness (mirroring `BudgetCapField.test.tsx`) is enough
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

describe("CpaReveal Target-CPA field (StepperField label/hint passthrough)", () => {
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

describe("EligibilityField (StepperField label/hint passthrough)", () => {
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

describe("LockupField (StepperField label/hint passthrough)", () => {
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

/**
 * `RecipientBox` (the ambassador/referee split inputs inside `CpaReveal`) only
 * needs `control` — same minimal harness shape as the other reveal fields.
 */
function RecipientBoxHarness({ hint }: { hint?: string }) {
    const form = useForm<RewardFormValues>({
        defaultValues: DEFAULT_REWARD_FORM,
    });

    return (
        <form>
            <RecipientBox
                control={form.control}
                name="ambassadorAmount"
                label="campaigns.create.reward.recipient.ambassadorReward"
                unit="amount"
                placeholder="campaigns.create.reward.recipient.ambassadorPlaceholder"
                hint={hint}
            />
        </form>
    );
}

describe("RecipientBox (StepperField label/hint passthrough)", () => {
    it("associates the DS control's own label to the control (accessible name)", () => {
        render(<RecipientBoxHarness />);

        const input = screen.getByLabelText(
            "campaigns.create.reward.recipient.ambassadorReward"
        );
        expect(input).toBeInTheDocument();
        const label = screen.getByText(
            "campaigns.create.reward.recipient.ambassadorReward"
        );
        expect(label.tagName).toBe("LABEL");
        expect(label).toHaveAttribute("for", input.id);
    });

    it("renders the hint, associated via aria-describedby, only when given", () => {
        const { rerender } = render(<RecipientBoxHarness />);

        expect(
            screen.queryByText("campaigns.create.reward.fixed.percentOfPool")
        ).not.toBeInTheDocument();

        rerender(
            <RecipientBoxHarness hint="campaigns.create.reward.fixed.percentOfPool" />
        );

        expect(
            screen.getByText("campaigns.create.reward.fixed.percentOfPool")
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText(
                "campaigns.create.reward.recipient.ambassadorReward"
            )
        ).toHaveAccessibleDescription(
            "campaigns.create.reward.fixed.percentOfPool"
        );
    });
});

describe("TierField (visual label column)", () => {
    it("renders the label text above the children when label is set", () => {
        render(
            <TierField label="Basket range">
                <input aria-label="from" />
            </TierField>
        );

        expect(screen.getByText("Basket range")).toBeInTheDocument();
        expect(screen.getByLabelText("from")).toBeInTheDocument();
    });

    it("renders children with no label element when label is omitted", () => {
        const { container } = render(
            <TierField>
                <input aria-label="to" />
            </TierField>
        );

        expect(container.querySelector("label")).toBeNull();
        expect(screen.getByLabelText("to")).toBeInTheDocument();
    });

    it("applies the padded class when padding is 'm'", () => {
        const { container: padded } = render(
            <TierField label="Ambassador reward" padding="m">
                <input aria-label="amount" />
            </TierField>
        );
        const { container: unpadded } = render(
            <TierField label="Ambassador reward">
                <input aria-label="amount" />
            </TierField>
        );

        expect(padded.firstElementChild?.className.split(" ")).toContain(
            styles.tierPadded
        );
        expect(unpadded.firstElementChild?.className.split(" ")).not.toContain(
            styles.tierPadded
        );
    });
});

/**
 * The basis toggle is only rendered for a product-scoped campaign, and is
 * forced (not merely defaulted) to the matched-items basis when the scope is
 * negated — the backend rejects any other combination.
 */
function BasisHarness({ locked }: { locked: boolean }) {
    const form = useForm<RewardFormValues>({
        defaultValues: DEFAULT_REWARD_FORM,
    });
    return (
        <form>
            <RewardBasisField control={form.control} locked={locked} />
        </form>
    );
}

describe("RewardBasisField", () => {
    it("offers both bases, defaulting to the basket", () => {
        render(<BasisHarness locked={false} />);

        const basket = screen.getByRole("radio", {
            name: /basis.basket.title/,
        });
        expect(basket).toBeChecked();
        expect(basket).not.toBeDisabled();
        expect(
            screen.getByRole("radio", { name: /basis.matchedItems.title/ })
        ).not.toBeDisabled();
    });

    it("lays the radio out before the text, not split apart", () => {
        // `referralRow` is space-between (text left, switch right). Reusing it
        // for a radio-first row would push the radio and its label to opposite
        // edges.
        const { container } = render(<BasisHarness locked={false} />);

        const row = container.querySelector("label");
        expect(row?.className.split(" ")).toContain(rows.optionRow);
        expect(row?.className.split(" ")).not.toContain(styles.referralRow);
    });

    it("locks onto the matched-items basis for a negated scope", () => {
        render(<BasisHarness locked={true} />);

        const matched = screen.getByRole("radio", {
            name: /basis.matchedItems.title/,
        });
        expect(matched).toBeChecked();
        expect(matched).toBeDisabled();
        expect(
            screen.getByRole("radio", { name: /basis.basket.title/ })
        ).toBeDisabled();
        // The merchant is told why the choice is not theirs.
        expect(
            screen.getByText("campaigns.create.reward.basis.lockedNote")
        ).toBeInTheDocument();
    });
});
