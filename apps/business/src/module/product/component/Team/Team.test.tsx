import { render, screen } from "@testing-library/react";
import type { Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Team } from "./index";

const mockProductId = "0x123" as Hex;

vi.mock("@/module/product/component/ProductHead", () => ({
    ProductHead: ({ productId }: { productId: Hex }) => (
        <div data-testid="product-head">Product Head {productId}</div>
    ),
}));

vi.mock("@/module/product/component/TableTeam", () => ({
    TableTeam: ({ productId }: { productId: Hex }) => (
        <div data-testid="table-team">Table Team {productId}</div>
    ),
}));

vi.mock("@/module/common/component/Panel", () => ({
    Panel: ({
        title,
        children,
    }: {
        title: string;
        children: React.ReactNode;
    }) => (
        <div data-testid="panel">
            <h2>{title}</h2>
            {children}
        </div>
    ),
}));

vi.mock("@/module/forms/Form", () => ({
    FormLayout: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="form-layout">{children}</div>
    ),
}));

describe("Team", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render ProductHead with productId", () => {
        render(<Team productId={mockProductId} />);

        expect(screen.getByTestId("product-head")).toBeInTheDocument();
        expect(
            screen.getByText(`Product Head ${mockProductId}`)
        ).toBeInTheDocument();
    });

    it("should render Panel with title", () => {
        render(<Team productId={mockProductId} />);

        expect(screen.getByText("Manage your team")).toBeInTheDocument();
    });

    it("should render TableTeam with productId", () => {
        render(<Team productId={mockProductId} />);

        expect(screen.getByTestId("table-team")).toBeInTheDocument();
        expect(
            screen.getByText(`Table Team ${mockProductId}`)
        ).toBeInTheDocument();
    });

    it("should render FormLayout wrapper", () => {
        render(<Team productId={mockProductId} />);

        expect(screen.getByTestId("form-layout")).toBeInTheDocument();
    });
});
