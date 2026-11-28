import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import campaignDetailsMock from "@/mock/campaignDetails.json";
import type { CampaignDetailsStats } from "@/module/campaigns/queries/queryOptions";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "en" },
    }),
}));

import { FunnelRoiTab } from "./FunnelRoiTab";
import { SubscriptionStatsCards } from "./SubscriptionStatsCards";

const subscription = {
    currency: "EUR",
    livePlans: 12,
    stepsPaid: 34,
    reserved: 250.5,
    paid: 99.9,
};

const regular = campaignDetailsMock as CampaignDetailsStats;

const amounts = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[role="img"]')).map((node) =>
        node.getAttribute("aria-label")
    );

describe("SubscriptionStatsCards", () => {
    it("shows live plans and steps paid as counts", () => {
        const { container } = render(
            <SubscriptionStatsCards subscription={subscription} />
        );

        expect(amounts(container).slice(0, 2)).toEqual(["12", "34"]);
    });

    it("shows what is reserved against what is paid in the campaign currency", () => {
        const { container } = render(
            <SubscriptionStatsCards subscription={subscription} />
        );

        expect(amounts(container).slice(2)).toEqual(["€250.50", "€99.90"]);
    });
});

describe("FunnelRoiTab subscription stats", () => {
    it("omits the subscription section for a regular campaign", () => {
        render(<FunnelRoiTab data={regular} />);

        expect(
            screen.queryByText("campaigns.details.subscription.title")
        ).not.toBeInTheDocument();
    });

    it("shows the subscription section when the details response carries stats", () => {
        render(<FunnelRoiTab data={{ ...regular, subscription }} />);

        expect(
            screen.getByText("campaigns.details.subscription.title")
        ).toBeInTheDocument();
        expect(
            screen.getByText("campaigns.details.subscription.livePlans")
        ).toBeInTheDocument();
    });
});
