import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SharingReward } from "../SharingPage/types";
import {
    PostShareConfirmation,
    type PostShareConfirmationProps,
} from "./index";

const t = (key: string) => key;
const CTA_KEY = "sdk.sharingPage.confirmation.cta";

function renderConfirmation(
    overrides: Partial<PostShareConfirmationProps> = {}
) {
    render(
        <PostShareConfirmation
            installUrl="/install?m=1&a=2"
            merchant={{ name: "Acme" }}
            chrome={{ mode: "full" }}
            reward={{ status: "loading" }}
            t={t}
            onDismiss={vi.fn()}
            onShareAgain={vi.fn()}
            onInstall={vi.fn()}
            {...overrides}
        />
    );

    return screen.getByRole("button", { name: CTA_KEY });
}

describe("PostShareConfirmation install CTA", () => {
    it("offers the install CTA when an install link exists", () => {
        expect(renderConfirmation()).toBeEnabled();
    });

    it("disables the install CTA only when there is no link at all", () => {
        expect(renderConfirmation({ installUrl: null })).toBeDisabled();
    });

    it("stays enabled for a credential-less merchant-only link", () => {
        // What the wallet's own /sharing page builds with no `a=` and no
        // checkout token: the store CTA behind it is the whole surface.
        const cta = renderConfirmation({ installUrl: "/install?m=merchant-1" });

        expect(cta).toBeEnabled();
    });
});

// Echoes the reward context onto the key, like SharingPage/index.test.tsx's
// stand-in, so assertions read against a concrete string per arm.
const contextT = (key: string, opts?: Record<string, unknown>) =>
    opts?.context ? `${key}_${opts.context}` : key;

const TITLE_KEY = "sdk.sharingPage.confirmation.title";
const POPUP_TITLE_KEY = "sdk.sharingPage.confirmation.cardPopupTitle";
const POPUP_DESC_KEY = "sdk.sharingPage.confirmation.cardPopupDescription";
const noReward = (key: string) => `${key}_noReward`;

function renderWithReward(reward: SharingReward) {
    render(
        <PostShareConfirmation
            installUrl="/install?m=1"
            merchant={{ name: "Acme" }}
            chrome={{ mode: "full" }}
            reward={reward}
            t={contextT}
            onDismiss={vi.fn()}
            onShareAgain={vi.fn()}
            onInstall={vi.fn()}
        />
    );
}

function expectRewardFree() {
    expect(screen.getByText(noReward(TITLE_KEY))).toBeInTheDocument();
    expect(screen.getByText(noReward(POPUP_TITLE_KEY))).toBeInTheDocument();
    expect(screen.getByText(noReward(POPUP_DESC_KEY))).toBeInTheDocument();
    expect(
        screen.getByRole("button", { name: noReward(CTA_KEY) })
    ).toBeInTheDocument();
}

function expectRewarded() {
    expect(screen.getByText(TITLE_KEY)).toBeInTheDocument();
    expect(screen.getByText(POPUP_TITLE_KEY)).toBeInTheDocument();
    expect(screen.getByText(POPUP_DESC_KEY)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: CTA_KEY })).toBeInTheDocument();
}

describe("PostShareConfirmation reward-free wording", () => {
    it("renders reward-free wording on the headline, the mock purchase notification and the install CTA while still resolving", () => {
        renderWithReward({ status: "loading" });
        expectRewardFree();
    });

    it("renders reward-free wording — not an empty amount — entered after a share that settled with nothing to advertise", () => {
        renderWithReward({ status: "empty" });
        expectRewardFree();
    });

    it("renders every string unchanged for a share that settled with a real reward", () => {
        renderWithReward({ status: "ready" });
        expectRewarded();
    });
});
