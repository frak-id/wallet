import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

import { LabeledNumberField } from "./index";
import type { ReferralChainFormValues } from "./utils";

/**
 * `LabeledNumberField` is the only referral-chain migration with bespoke
 * label/hint wiring: a manual `useId` + standalone `FieldLabel` + hand-written
 * `aria-describedby` (rather than the DS composed `label`/`hint` props). A
 * minimal `useForm` harness (mirroring `BudgetCampaign.test.tsx`) exercises that
 * association contract without the wizard page.
 */
function Harness() {
    const form = useForm<ReferralChainFormValues>({
        defaultValues: {
            enabled: true,
            deperditionPerLevel: "",
            maxDepth: "",
        },
        mode: "onChange",
    });

    return (
        <LabeledNumberField
            control={form.control}
            name="deperditionPerLevel"
            label="Decrease per level"
            hint="Each deeper level earns less"
            placeholder="50"
        />
    );
}

describe("LabeledNumberField (ReferralChain FieldLabel + manual aria wiring)", () => {
    it("associates the FieldLabel to the control via htmlFor", () => {
        render(<Harness />);

        const input = screen.getByLabelText("Decrease per level");
        expect(input).toBeInTheDocument();
        const label = screen.getByText("Decrease per level");
        expect(label.tagName).toBe("LABEL");
        expect(label).toHaveAttribute("for", input.id);
    });

    it("links the hint to the control via aria-describedby (controlId-hint)", () => {
        render(<Harness />);

        const input = screen.getByLabelText("Decrease per level");
        const hint = screen.getByText("Each deeper level earns less");
        // The manual `aria-describedby` must resolve to the FieldLabel's hint
        // node — the exact id contract both sides rely on is `${controlId}-hint`.
        expect(input).toHaveAttribute("aria-describedby", `${input.id}-hint`);
        expect(hint).toHaveAttribute("id", `${input.id}-hint`);
        expect(input).toHaveAccessibleDescription(
            "Each deeper level earns less"
        );
    });

    it("renders exactly one label (no duplicate header)", () => {
        const { container } = render(<Harness />);

        expect(container.querySelectorAll("label")).toHaveLength(1);
    });
});
