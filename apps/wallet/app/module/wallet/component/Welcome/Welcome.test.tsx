import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Welcome } from "./index";

const mockT = vi.fn((key: string) => key);

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: mockT,
    }),
}));

vi.mock("@/module/common/component/Panel", () => ({
    Panel: ({
        isDismissible,
        children,
    }: {
        isDismissible?: boolean;
        children: React.ReactNode;
    }) => (
        <div data-testid="panel" data-dismissible={isDismissible}>
            {children}
        </div>
    ),
}));

vi.mock("@/module/common/component/Title", () => ({
    Title: ({
        size,
        children,
    }: {
        size?: string;
        children: React.ReactNode;
    }) => (
        <h1 data-testid="title" data-size={size}>
            {children}
        </h1>
    ),
}));

describe("Welcome", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render Panel with dismissible prop", () => {
        render(<Welcome />);

        const panel = screen.getByTestId("panel");
        expect(panel).toHaveAttribute("data-dismissible", "true");
    });

    it("should render Title with big size", () => {
        render(<Welcome />);

        const title = screen.getByTestId("title");
        expect(title).toHaveAttribute("data-size", "big");
    });

    it("should translate welcome title", () => {
        render(<Welcome />);

        expect(mockT).toHaveBeenCalledWith("wallet.welcome.title");
    });

    it("should translate welcome text", () => {
        render(<Welcome />);

        expect(mockT).toHaveBeenCalledWith("wallet.welcome.text");
    });

    it("should render translated text content", () => {
        mockT.mockImplementation((key: string) => {
            if (key === "wallet.welcome.title") return "Welcome!";
            if (key === "wallet.welcome.text") return "Welcome text";
            return key;
        });

        render(<Welcome />);

        expect(screen.getByText("Welcome!")).toBeInTheDocument();
        expect(screen.getByText("Welcome text")).toBeInTheDocument();
    });
});
