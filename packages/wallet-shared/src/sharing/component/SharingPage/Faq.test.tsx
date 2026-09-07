import type { EstimatedReward } from "@frak-labs/core-sdk";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Faq } from "./Faq";
import type { SharingReward } from "./types";

const t = (key: string, opts?: Record<string, unknown>): string =>
    key === "sdk.sharingPage.faq.reward.referrerLabel"
        ? "Reward as ambassador"
        : key === "sdk.sharingPage.faq.reward.percentOfBasket"
          ? `${opts?.percent}% of basket`
          : key;

const percentage = (percent: number): EstimatedReward => ({
    payoutType: "percentage",
    percent,
    percentOf: "purchase_amount",
});

const readyWithBreakdown: SharingReward = {
    status: "ready",
    breakdown: { referrer: percentage(10), minPurchaseValue: 50 },
};

/** Radix only mounts an accordion panel once it is open. */
function openQuestion(id: string) {
    fireEvent.click(screen.getByText(`sdk.sharingPage.faq.q${id}`));
}

describe("Faq", () => {
    it("renders every question, keyed by a declared id rather than a list index", () => {
        render(<Faq reward={{ status: "loading" }} t={t} />);

        for (const id of ["1", "2", "3", "4", "5", "6"]) {
            expect(
                screen.getByText(`sdk.sharingPage.faq.q${id}`)
            ).toBeInTheDocument();
        }
    });

    it("attaches the reward breakdown to the slot that declares it", () => {
        render(<Faq reward={readyWithBreakdown} t={t} />);
        openQuestion("6");

        expect(screen.getByText("Reward as ambassador")).toBeInTheDocument();
    });

    it("puts it on no other question", () => {
        render(<Faq reward={readyWithBreakdown} t={t} />);
        openQuestion("5");

        expect(
            screen.queryByText("Reward as ambassador")
        ).not.toBeInTheDocument();
    });

    it("renders no breakdown while the reward is still loading", () => {
        render(<Faq reward={{ status: "loading" }} t={t} />);
        openQuestion("6");

        expect(
            screen.queryByText("Reward as ambassador")
        ).not.toBeInTheDocument();
    });
});
