import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SharingPage, type SharingPageProps } from "./index";

// stand-in `t` echoing the interpolated context/values, so assertions read
// against concrete text instead of raw keys
const t = (key: string, opts?: Record<string, unknown>): string => {
    switch (key) {
        case "sdk.sharingPage.card.tagline1":
            return opts?.context === "noReward"
                ? "A friend buys through your link,"
                : "on every purchase!";
        case "sdk.sharingPage.card.tagline2":
            if (opts?.context === "noReward") return "you get rewarded.";
            return opts?.context === "product"
                ? "on selected products!"
                : "on every purchase!";
        case "sdk.sharingPage.steps.2.description":
            return opts?.context
                ? `Step2-${opts.context}-${opts.minAmount ?? ""}`
                : "Step2-default";
        case "sdk.sharingPage.card.amount":
            return opts?.context === "noReward"
                ? "Earn rewards on every purchase"
                : "10 %";
        case "sdk.sharingPage.card.label":
            return "Credited to your account";
        case "sdk.sharingPage.faq.a6":
            return opts?.context === "noReward"
                ? "This brand has no active reward, so no amount is shown."
                : "The amount shown is the maximum reward you can earn.";
        case "sdk.sharingPage.products.label":
            return "Choose one product to share";
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
    share: { canShare: true, isSharing: false, canAct: true },
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

describe("SharingPage — product picker (PSC-27)", () => {
    type PickerItems = NonNullable<SharingPageProps["products"]>["items"];

    const withProducts = (
        items: PickerItems,
        overrides: Partial<NonNullable<SharingPageProps["products"]>> = {}
    ): SharingPageProps => ({
        ...baseProps,
        products: { items, selectedIndex: 0, onSelect: () => {}, ...overrides },
    });

    it("renders a card for each titled product", () => {
        render(
            <SharingPage
                {...withProducts([
                    { title: "Shoes", sku: "SHOE-42" },
                    { title: "Socks", sku: "SOCK-9" },
                ])}
            />
        );
        expect(screen.getByText("Shoes")).toBeInTheDocument();
        expect(screen.getByText("Socks")).toBeInTheDocument();
    });

    it("draws no card for a title-less product", () => {
        const { container } = render(
            <SharingPage
                {...withProducts([
                    { sku: "HIDDEN-1" },
                    { title: "Socks", sku: "SOCK-9" },
                ])}
            />
        );
        expect(screen.getByText("Socks")).toBeInTheDocument();
        expect(container.textContent).not.toContain("HIDDEN-1");
    });

    it("renders no picker at all when every product is title-less", () => {
        render(<SharingPage {...withProducts([{ sku: "HIDDEN-1" }])} />);
        expect(screen.queryByRole("radiogroup")).toBeNull();
    });

    it("renders one radio per titled product inside a single radiogroup", () => {
        render(
            <SharingPage
                {...withProducts([
                    { title: "Shoes", sku: "SHOE-42" },
                    { title: "Socks", sku: "SOCK-9" },
                ])}
            />
        );
        expect(screen.getAllByRole("radiogroup")).toHaveLength(1);
        expect(screen.getAllByRole("radio")).toHaveLength(2);
    });

    it("checks only the selected card", () => {
        render(
            <SharingPage
                {...withProducts(
                    [
                        { title: "Shoes", sku: "SHOE-42" },
                        { title: "Socks", sku: "SOCK-9" },
                    ],
                    { selectedIndex: 1 }
                )}
            />
        );
        const [shoes, socks] = screen.getAllByRole("radio");
        expect(shoes).toHaveAttribute("aria-checked", "false");
        expect(socks).toHaveAttribute("aria-checked", "true");
    });

    it("selects by the index into items, not into the rendered subset", () => {
        // The title-less entry draws nothing but still occupies index 0;
        // renumbering here would scope the share to the wrong product.
        const onSelect = vi.fn();
        render(
            <SharingPage
                {...withProducts(
                    [
                        { sku: "HIDDEN-1" },
                        { title: "Shoes", sku: "SHOE-42" },
                        { title: "Socks", sku: "SOCK-9" },
                    ],
                    { selectedIndex: 1, onSelect }
                )}
            />
        );
        fireEvent.click(screen.getByText("Socks"));
        expect(onSelect).toHaveBeenCalledWith(2);
    });

    it("keeps the selection when the selected card is clicked again", () => {
        const onSelect = vi.fn();
        render(
            <SharingPage
                {...withProducts(
                    [
                        { title: "Shoes", sku: "SHOE-42" },
                        { title: "Socks", sku: "SOCK-9" },
                    ],
                    { selectedIndex: 1, onSelect }
                )}
            />
        );
        fireEvent.click(screen.getByText("Socks"));
        // Never index 0 by way of `Number("")`, and never a cleared group.
        expect(onSelect).not.toHaveBeenCalledWith(0);
    });

    it("keeps the label a sibling of the radio, never its wrapper", () => {
        // Structural on purpose: Radix commits an arrow move by clicking the
        // focused radio, and a wrapping label re-dispatches that click, so the
        // selection silently lags focus by one. Nothing else catches it.
        render(
            <SharingPage
                {...withProducts([{ title: "Shoes", sku: "SHOE-42" }])}
            />
        );
        expect(
            screen.getByRole("radio", { name: "Shoes" }).closest("label")
        ).toBeNull();
    });

    it("names each radio by its product title", () => {
        render(
            <SharingPage
                {...withProducts([{ title: "Shoes", sku: "SHOE-42" }])}
            />
        );
        expect(
            screen.getByRole("radio", { name: "Shoes" })
        ).toBeInTheDocument();
    });

    it("labels the group so the single-choice intent is announced", () => {
        render(
            <SharingPage
                {...withProducts([{ title: "Shoes", sku: "SHOE-42" }])}
            />
        );
        expect(screen.getByRole("radiogroup")).toHaveAccessibleName(
            "Choose one product to share"
        );
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

describe("SharingPage — reward-free hero", () => {
    const emptyReward: SharingPageProps["reward"] = { status: "empty" };

    it("shows the qualitative headline instead of an amount and drops the 'credited' label", () => {
        render(<SharingPage {...baseProps} reward={emptyReward} />);
        expect(
            screen.getByText("Earn rewards on every purchase")
        ).toBeInTheDocument();
        expect(screen.queryByText("10 %")).not.toBeInTheDocument();
        expect(
            screen.queryByText("Credited to your account")
        ).not.toBeInTheDocument();
    });

    it("keeps the hero markup and strings unchanged for a real reward", () => {
        render(<SharingPage {...baseProps} />);
        expect(
            screen.getByText("Credited to your account")
        ).toBeInTheDocument();
        expect(screen.getByText("10 %")).toBeInTheDocument();
    });

    it("keeps the share and copy CTAs enabled on the same terms as any other state", () => {
        render(<SharingPage {...baseProps} reward={emptyReward} />);
        expect(screen.getByTestId("sharing-share")).toBeEnabled();
        expect(screen.getByTestId("sharing-copy")).toBeEnabled();
    });

    it("states in the FAQ that no amount is shown because the brand has no active reward", () => {
        render(<SharingPage {...baseProps} reward={emptyReward} />);
        fireEvent.click(screen.getByText("sdk.sharingPage.faq.q6"));
        expect(
            screen.getByText(
                "This brand has no active reward, so no amount is shown."
            )
        ).toBeInTheDocument();
    });

    it("leaves the FAQ reward-calculation answer unchanged for a real reward", () => {
        render(<SharingPage {...baseProps} />);
        fireEvent.click(screen.getByText("sdk.sharingPage.faq.q6"));
        expect(
            screen.getByText(
                "The amount shown is the maximum reward you can earn."
            )
        ).toBeInTheDocument();
    });

    it("renders the skeleton, not the reward-free copy, while still resolving", () => {
        render(<SharingPage {...baseProps} reward={{ status: "loading" }} />);
        expect(
            screen.queryByText("Earn rewards on every purchase")
        ).not.toBeInTheDocument();
    });
});
