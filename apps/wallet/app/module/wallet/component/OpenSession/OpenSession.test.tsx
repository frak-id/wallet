import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenSession } from "./index";

const mockUseInteractionSessionStatus = vi.fn();
const mockUseAccount = vi.fn();

vi.mock("@frak-labs/wallet-shared", () => ({
    useInteractionSessionStatus: (props: any) =>
        mockUseInteractionSessionStatus(props),
}));

vi.mock("wagmi", () => ({
    useAccount: () => mockUseAccount(),
}));

vi.mock("@/module/common/component/Panel", () => ({
    Panel: ({
        variant,
        size,
        children,
    }: {
        variant?: string;
        size?: string;
        children: React.ReactNode;
    }) => (
        <div data-testid="panel" data-variant={variant} data-size={size}>
            {children}
        </div>
    ),
}));

vi.mock("@/module/common/component/ToggleSession", () => ({
    ToggleSession: () => <div data-testid="toggle-session">Toggle Session</div>,
}));

vi.mock("@/module/common/component/Warning", () => ({
    Warning: ({
        text,
        children,
    }: {
        text: string;
        children?: React.ReactNode;
    }) => (
        <div data-testid="warning">
            {text}
            {children}
        </div>
    ),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe("OpenSession", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAccount.mockReturnValue({
            address: "0x1234567890123456789012345678901234567890",
        });
    });

    it("should return null when session status is pending", () => {
        mockUseInteractionSessionStatus.mockReturnValue({
            data: null,
            isPending: true,
        });

        const { container } = render(<OpenSession />);

        expect(container.firstChild).toBeNull();
    });

    it("should return null when session is already open", () => {
        mockUseInteractionSessionStatus.mockReturnValue({
            data: { isOpen: true },
            isPending: false,
        });

        const { container } = render(<OpenSession />);

        expect(container.firstChild).toBeNull();
    });

    it("should render Panel when session is closed", () => {
        mockUseInteractionSessionStatus.mockReturnValue({
            data: null,
            isPending: false,
        });

        render(<OpenSession />);

        expect(screen.getByTestId("panel")).toBeInTheDocument();
        expect(screen.getByTestId("panel")).toHaveAttribute(
            "data-variant",
            "invisible"
        );
        expect(screen.getByTestId("panel")).toHaveAttribute(
            "data-size",
            "none"
        );
    });

    it("should render ToggleSession when session is closed", () => {
        mockUseInteractionSessionStatus.mockReturnValue({
            data: null,
            isPending: false,
        });

        render(<OpenSession />);

        expect(screen.getByTestId("toggle-session")).toBeInTheDocument();
    });

    it("should render Warning when session is closed", async () => {
        mockUseInteractionSessionStatus.mockReturnValue({
            data: null,
            isPending: false,
        });

        render(<OpenSession />);

        await waitFor(() => {
            expect(screen.getByTestId("warning")).toBeInTheDocument();
        });
    });

    it("should pass address to useInteractionSessionStatus", () => {
        const mockAddress = "0x9876543210987654321098765432109876543210";
        mockUseAccount.mockReturnValue({ address: mockAddress });
        mockUseInteractionSessionStatus.mockReturnValue({
            data: null,
            isPending: false,
        });

        render(<OpenSession />);

        expect(mockUseInteractionSessionStatus).toHaveBeenCalledWith({
            address: mockAddress,
        });
    });
});
