import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getStep2Context, SharingPage, type SharingPageProps } from "./index";

// stand-in `t` echoing the interpolated context/values, so assertions read
// against concrete text instead of raw keys
const t = (key: string, opts?: Record<string, unknown>): string => {
    switch (key) {
        case "sdk.sharingPage.card.tagline1":
            return "on every purchase!";
        case "sdk.sharingPage.card.tagline2":
            return opts?.context === "product"
                ? "on selected products!"
                : "on every purchase!";
        case "sdk.sharingPage.steps.2.description":
            return opts?.context
                ? `Step2-${opts.context}-${opts.minAmount ?? ""}`
                : "Step2-default";
        case "sdk.sharingPage.card.amount":
            return "10 %";
        default:
            return key;
    }
};

const baseProps: SharingPageProps = {
    merchant: { name: "Test Merchant" },
    view: "share",
    chrome: { mode: "full" },
    sharingLink: null,
    installUrl: null,
    reward: { status: "ready" },
    share: { canShare: true, isSharing: false },
    t,
    actions: {
        onShare: () => {},
        onCopy: () => {},
        onDismiss: () => {},
        onShareAgain: () => {},
        onInstall: () => {},
        onConfirmationDismiss: () => {},
    },
};

/** `baseProps` with a ready reward carrying `overrides`. */
const withReward = (
    overrides: Partial<Extract<SharingPageProps["reward"], { status: "ready" }>>
): SharingPageProps => ({
    ...baseProps,
    reward: { status: "ready", ...overrides },
});

describe("getStep2Context", () => {
    it("returns undefined when neither gate applies", () => {
        expect(getStep2Context(false, undefined)).toBeUndefined();
    });

    it("returns 'min' when only a minimum purchase gates the reward", () => {
        expect(getStep2Context(false, "10 €")).toBe("min");
    });

    it("returns 'product' when only a productScope gates the reward", () => {
        expect(getStep2Context(true, undefined)).toBe("product");
    });

    it("returns 'min_product' when both gates apply", () => {
        expect(getStep2Context(true, "10 €")).toBe("min_product");
    });
});

describe("SharingPage — tagline2 / step2 copy", () => {
    it("uses the default tagline2 copy for an unscoped campaign", () => {
        const { container } = render(
            <SharingPage {...withReward({ isProductScoped: false })} />
        );
        expect(container.textContent).toContain("on every purchase!");
        expect(container.textContent).not.toContain("on selected products!");
    });

    it("switches to the product-scoped tagline2 copy when isProductScoped is true", () => {
        const { container } = render(
            <SharingPage {...withReward({ isProductScoped: true })} />
        );
        expect(container.textContent).toContain("on selected products!");
    });

    it("resolves the plain step2 copy when neither gate applies", () => {
        render(<SharingPage {...withReward({ isProductScoped: false })} />);
        expect(screen.getByText("Step2-default")).toBeInTheDocument();
    });

    it("resolves the 'min' step2 context when only a minimum purchase gates the reward", () => {
        render(
            <SharingPage
                {...withReward({
                    isProductScoped: false,
                    minPurchaseAmount: "10 €",
                })}
            />
        );
        expect(screen.getByText("Step2-min-10 €")).toBeInTheDocument();
    });

    it("resolves the 'product' step2 context when only a productScope gates the reward", () => {
        render(<SharingPage {...withReward({ isProductScoped: true })} />);
        expect(screen.getByText("Step2-product-")).toBeInTheDocument();
    });

    it("resolves the 'min_product' step2 context when both gates apply", () => {
        render(
            <SharingPage
                {...withReward({
                    isProductScoped: true,
                    minPurchaseAmount: "10 €",
                })}
            />
        );
        expect(screen.getByText("Step2-min_product-10 €")).toBeInTheDocument();
    });

    it("skeleton-gates tagline2 while the reward is loading, instead of flashing the unscoped copy", () => {
        render(<SharingPage {...baseProps} reward={{ status: "loading" }} />);
        expect(
            screen.queryByText("on every purchase!")
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText("on selected products!")
        ).not.toBeInTheDocument();
    });
});
