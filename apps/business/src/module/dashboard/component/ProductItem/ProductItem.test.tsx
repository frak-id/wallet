import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductItem } from "./index";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to, params, ...props }: any) => (
        <a href={`${to}/${params?.id}`} {...props}>
            {children}
        </a>
    ),
}));

describe("ProductItem", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it("should render with name", () => {
        render(<ProductItem name="Test Product" />);

        expect(screen.getByText("Test Product")).toBeInTheDocument();
    });

    it("should render with domain as link when isLink is true", () => {
        render(<ProductItem name="Product" domain="example.com" />);

        const domainLink = screen.getByText("example.com");
        expect(domainLink).toBeInTheDocument();
        expect(domainLink.tagName).toBe("A");
        expect(domainLink).toHaveAttribute("href", "//example.com");
        expect(domainLink).toHaveAttribute("target", "_blank");
    });

    it("should render with domain as span when isLink is false", () => {
        const { container } = render(
            <ProductItem
                name="Product"
                domain="example.com"
                isLink={false}
                showActions={false}
            />
        );

        // Should have a span element with the domain text
        const spans = Array.from(container.querySelectorAll("span")).filter(
            (el) => el.textContent === "example.com"
        );
        expect(spans.length).toBeGreaterThan(0);
        expect(spans[0]?.tagName).toBe("SPAN");
    });

    it("should render actions when showActions is true", () => {
        render(
            <ProductItem name="Product" merchantId="merchant-123" showActions />
        );

        const links = screen.getAllByRole("link");
        expect(links.length).toBeGreaterThan(0);
    });

    it("should not render actions when showActions is false", () => {
        const { container } = render(
            <ProductItem
                name="Product"
                merchantId="merchant-123"
                showActions={false}
            />
        );

        // Debug: check what's in the DOM
        const allLinks = container.querySelectorAll("a");
        // Component with showActions=false should not render action links
        // There should be no links at all since no domain is provided
        expect(allLinks).toHaveLength(0);
    });

    it("should not render actions when merchantId is not provided", () => {
        render(<ProductItem name="Product" showActions />);

        const links = screen.queryAllByRole("link");
        expect(links).toHaveLength(0);
    });

    it("should render with ReactElement name", () => {
        render(
            <ProductItem name={<span data-testid="custom-name">Custom</span>} />
        );

        expect(screen.getByTestId("custom-name")).toBeInTheDocument();
    });
});
