import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RewardCard } from "./RewardCard";
import type { SharingReward } from "./types";

const t = (key: string): string => key;
const merchant = { name: "Test Merchant" };
const upToLabel = "sdk.sharingPage.card.upTo";

describe("RewardCard", () => {
    it.each<[string, SharingReward]>([
        ["a tiered reward", { status: "ready", payoutType: "tiered" }],
        ["a subscription plan", { status: "ready", upTo: true }],
    ])("marks %s as a ceiling", (_, reward) => {
        render(<RewardCard merchant={merchant} reward={reward} t={t} />);

        expect(screen.getByText(upToLabel)).toBeInTheDocument();
    });

    it("shows a fixed reward as is", () => {
        render(
            <RewardCard
                merchant={merchant}
                reward={{ status: "ready", payoutType: "fixed" }}
                t={t}
            />
        );

        expect(screen.queryByText(upToLabel)).not.toBeInTheDocument();
    });
});
