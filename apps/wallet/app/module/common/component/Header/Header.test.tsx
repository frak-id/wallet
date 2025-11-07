import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./index";

const mockSessionStore = vi.fn();
const mockUseHydrated = vi.fn(() => true);

vi.mock("@frak-labs/wallet-shared", () => ({
    sessionStore: (selector: any) => mockSessionStore(selector),
    selectSession: (state: any) => state.session,
}));

vi.mock("remix-utils/use-hydrated", () => ({
    useHydrated: () => mockUseHydrated(),
}));

vi.mock("react-router", async () => {
    const actual = await vi.importActual("react-router");
    return {
        ...actual,
        Link: ({ children, to, ...props }: any) => (
            <a href={to} {...props}>
                {children}
            </a>
        ),
    };
});

describe("Header", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseHydrated.mockReturnValue(true);
    });

    it("should render logo link", () => {
        mockSessionStore.mockReturnValue(null);

        render(<Header />);

        const logoLink = screen.getByRole("link", { name: /frak/i });
        expect(logoLink).toBeInTheDocument();
        expect(logoLink).toHaveAttribute("href", "/wallet");
    });

    it("should render notifications link when session exists and hydrated", () => {
        const mockSession = { id: "test-session" };
        mockSessionStore.mockReturnValue(mockSession);
        mockUseHydrated.mockReturnValue(true);

        render(<Header />);

        const links = screen.getAllByRole("link");
        const notificationLink = links.find(
            (link) => link.getAttribute("href") === "/notifications"
        );
        expect(notificationLink).toBeInTheDocument();
    });

    it("should not render notifications link when not hydrated", () => {
        const mockSession = { id: "test-session" };
        mockSessionStore.mockReturnValue(mockSession);
        mockUseHydrated.mockReturnValue(false);

        render(<Header />);

        const links = screen.getAllByRole("link");
        expect(links).toHaveLength(1); // Only logo link
        expect(links[0]).toHaveAttribute("href", "/wallet");
    });

    it("should not render notifications link when no session", () => {
        mockSessionStore.mockReturnValue(null);

        render(<Header />);

        const links = screen.getAllByRole("link");
        expect(links).toHaveLength(1); // Only logo link
        expect(links[0]).toHaveAttribute("href", "/wallet");
    });
});
