import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MerchantItem } from "./index";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to, params, ...props }: any) => (
        <a href={to.replace("$merchantId", params?.merchantId)} {...props}>
            {children}
        </a>
    ),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

describe("MerchantItem", () => {
    afterEach(() => {
        cleanup();
    });

    const props = {
        merchantId: "merchant-123",
        name: "Acme Store",
        domain: "acme.example.com",
        onManageBudget: vi.fn(),
    };

    it("should render name and domain", () => {
        render(<MerchantItem {...props} />);

        expect(screen.getByText("Acme Store")).toBeInTheDocument();
        expect(screen.getByText("acme.example.com")).toBeInTheDocument();
    });

    it("should render the domain as plain text", () => {
        render(<MerchantItem {...props} />);

        expect(screen.getByText("acme.example.com").tagName).not.toBe("A");
    });

    it("should open the budget sheet from the manage budget button", () => {
        const onManageBudget = vi.fn();
        render(<MerchantItem {...props} onManageBudget={onManageBudget} />);

        fireEvent.click(
            screen.getByRole("button", {
                name: "dashboard.actions.manageBudget",
            })
        );

        expect(onManageBudget).toHaveBeenCalledTimes(1);
    });

    it("should link to the merchant edit page", () => {
        render(<MerchantItem {...props} />);

        const links = screen.getAllByRole("link");
        expect(links).toHaveLength(1);
        expect(links[0]).toHaveAttribute(
            "href",
            "/m/merchant-123/merchant/customize"
        );
    });

    it("should render avatar initials", () => {
        render(<MerchantItem {...props} />);

        expect(screen.getByText("AS")).toBeInTheDocument();
    });
});
