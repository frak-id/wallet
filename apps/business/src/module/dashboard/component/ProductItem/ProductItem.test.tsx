import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductItem } from "./index";

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children, to, params, ...props }: any) => (
        <a href={`${to}/${params?.id}`} {...props}>
            {children}
        </a>
    ),
}));

describe("ProductItem", () => {
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
        render(
            <ProductItem name="Product" domain="example.com" isLink={false} />
        );

        const domainSpan = screen.getByText("example.com");
        expect(domainSpan).toBeInTheDocument();
        expect(domainSpan.tagName).toBe("SPAN");
    });

    it("should render actions when showActions is true", () => {
        render(<ProductItem name="Product" id="0x123" showActions />);

        const links = screen.getAllByRole("link");
        expect(links.length).toBeGreaterThan(0);
    });

    it("should not render actions when showActions is false", () => {
        render(<ProductItem name="Product" id="0x123" showActions={false} />);

        const links = screen.queryAllByRole("link");
        expect(links).toHaveLength(0);
    });

    it("should not render actions when id is not provided", () => {
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
