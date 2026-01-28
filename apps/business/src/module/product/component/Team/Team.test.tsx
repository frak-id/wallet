import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Team } from "./index";

const mockMerchantId = "mock-merchant-id";

vi.mock("@/module/product/component/TableTeam", () => ({
    TableTeam: ({ merchantId }: { merchantId: string }) => (
        <div data-testid="table-team">Table Team {merchantId}</div>
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

    it("should render Panel with title", () => {
        render(<Team merchantId={mockMerchantId} />);

        expect(screen.getByText("Manage your team")).toBeInTheDocument();
    });

    it("should render TableTeam with merchantId", () => {
        render(<Team merchantId={mockMerchantId} />);

        expect(screen.getByTestId("table-team")).toBeInTheDocument();
        expect(
            screen.getByText(`Table Team ${mockMerchantId}`)
        ).toBeInTheDocument();
    });

    it("should render FormLayout wrapper", () => {
        render(<Team merchantId={mockMerchantId} />);

        expect(screen.getByTestId("form-layout")).toBeInTheDocument();
    });
});
