import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { campaignStore } from "@/stores/campaignStore";

const merchant = vi.hoisted(() => ({
    provider: null as "recharge" | null | "loading",
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));
vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
}));
vi.mock("@/module/campaigns/hook/useSaveCampaign", () => ({
    useSaveCampaign: () => ({ isPending: false, isError: false }),
}));
vi.mock("@/module/common/hook/useActiveMerchantId", () => ({
    useActiveMerchantId: () => "m1",
}));
vi.mock("@/module/merchant/hook/useMerchant", () => ({
    useMerchant: () => ({
        data:
            merchant.provider === "loading"
                ? undefined
                : { subscriptionProvider: merchant.provider },
    }),
}));

import * as styles from "./goalsCampaign.css";
import { GoalsCampaign } from "./index";

const NOT_CONNECTED =
    "campaigns.create.goals.options.subscription.notConnected";

function renderStep(provider: "recharge" | null | "loading") {
    merchant.provider = provider;
    onTestFinished(() => {
        merchant.provider = null;
        campaignStore.getState().reset();
    });
    return render(<GoalsCampaign />);
}

describe("GoalsCampaign subscription goal", () => {
    it("lists the subscription goal right under sales", () => {
        renderStep("recharge");

        const ids = screen.getAllByRole("radio").map((radio) => radio.id);
        expect(ids.slice(0, 2)).toEqual(["goal-sales", "goal-subscription"]);
    });

    it("locks the subscription goal with a hint until a provider is connected", () => {
        renderStep(null);

        expect(document.getElementById("goal-subscription")).toBeDisabled();
        expect(screen.getByText(NOT_CONNECTED)).toBeInTheDocument();
    });

    it("links the lock hint to the subscription radio", () => {
        renderStep(null);

        expect(
            screen.getByRole("radio", {
                name: /campaigns.create.goals.options.subscription.title/,
            })
        ).toHaveAccessibleDescription(NOT_CONNECTED);
    });

    it("keeps the hint line out of the dimmed text", () => {
        renderStep(null);

        expect(screen.getByText(NOT_CONNECTED).className).not.toContain(
            styles.dimmed
        );
        expect(
            screen.getByText(
                "campaigns.create.goals.options.subscription.title"
            ).className
        ).toContain(styles.dimmed);
    });

    it("leaves the subscription goal open while the merchant is loading", () => {
        renderStep("loading");

        expect(document.getElementById("goal-subscription")).toBeEnabled();
        expect(screen.queryByText(NOT_CONNECTED)).not.toBeInTheDocument();
    });

    it("unlocks the subscription goal once a provider is connected", () => {
        renderStep("recharge");

        expect(document.getElementById("goal-subscription")).toBeEnabled();
        expect(screen.queryByText(NOT_CONNECTED)).not.toBeInTheDocument();
    });

    it("keeps an already chosen subscription goal selectable after a disconnect", () => {
        act(() =>
            campaignStore.getState().updateDraft((d) => ({
                ...d,
                metadata: { ...d.metadata, goal: "subscription" },
            }))
        );
        renderStep(null);

        expect(document.getElementById("goal-subscription")).toBeEnabled();
    });
});
