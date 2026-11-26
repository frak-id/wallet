import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => vi.fn(),
    useParams: () => ({ merchantId: "m1", campaignId: "c1" }),
}));

vi.mock("@/module/common/hook/useActiveMerchantId", () => ({
    useActiveMerchantId: () => "m1",
}));

vi.mock("@/module/common/component/WizardLayout", () => ({
    WizardLayout: ({
        headerLeading,
        footer,
        children,
    }: {
        headerLeading?: ReactNode;
        footer?: ReactNode;
        children: ReactNode;
    }) => (
        <div>
            <header>{headerLeading}</header>
            <main>{children}</main>
            <footer>{footer}</footer>
        </div>
    ),
}));

vi.mock("../NewCampaign/ButtonCancel", () => ({
    ButtonCancel: () => <button type="button">cancel</button>,
}));

import { WizardStep } from "./index";

const REASON = "Choose a goal to continue.";

function renderStep(props: Partial<Parameters<typeof WizardStep>[0]> = {}) {
    return render(
        <WizardStep stepKey="goals" formId="goals-form" {...props}>
            <p>content</p>
        </WizardStep>
    );
}

describe("WizardStep disabledReason", () => {
    it("shows the reason while the step is invalid", () => {
        renderStep({ isValid: false, disabledReason: REASON });

        expect(screen.getByText(REASON)).toBeInTheDocument();
    });

    it("hides the reason once the step is valid", () => {
        renderStep({ isValid: true, disabledReason: REASON });

        expect(screen.queryByText(REASON)).not.toBeInTheDocument();
    });

    it("hides the reason while the step is saving", () => {
        renderStep({
            isValid: false,
            isPending: true,
            disabledReason: REASON,
        });

        expect(screen.queryByText(REASON)).not.toBeInTheDocument();
    });

    it("renders no reason when none is given", () => {
        renderStep({ isValid: false });

        expect(
            screen.getByRole("button", {
                name: "campaigns.create.actions.continue",
            })
        ).not.toHaveAttribute("aria-describedby");
    });

    it("links the disabled button to the reason through aria-describedby", () => {
        renderStep({ isValid: false, disabledReason: REASON });

        const button = screen.getByRole("button", {
            name: "campaigns.create.actions.continue",
        });
        expect(button).toBeDisabled();
        expect(button).toHaveAccessibleDescription(REASON);
    });

    it("drops aria-describedby once the step is valid", () => {
        renderStep({ isValid: true, disabledReason: REASON });

        expect(
            screen.getByRole("button", {
                name: "campaigns.create.actions.continue",
            })
        ).not.toHaveAttribute("aria-describedby");
    });
});

describe("WizardStep tour anchors", () => {
    it("marks the last step button as the publish anchor", () => {
        renderStep({ stepKey: "validation" });

        expect(
            screen.getByRole("button", {
                name: "campaigns.create.actions.publish",
            })
        ).toHaveAttribute("data-tour", "campaign-publish");
    });

    it("leaves the Continue button of earlier steps without an anchor", () => {
        renderStep({ stepKey: "budget" });

        expect(
            screen.getByRole("button", {
                name: "campaigns.create.actions.continue",
            })
        ).not.toHaveAttribute("data-tour");
    });
});

describe("WizardStep back arrow", () => {
    it("carries a visible title on steps after the first", () => {
        renderStep({ stepKey: "goals" });

        expect(
            screen.getByTitle("campaigns.create.actions.back")
        ).toBeInTheDocument();
    });

    it("has no back arrow on the first step", () => {
        renderStep({ stepKey: "basics" });

        expect(
            screen.queryByTitle("campaigns.create.actions.back")
        ).not.toBeInTheDocument();
    });
});
