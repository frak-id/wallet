import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomTabBar } from "./index";

// `<Link>` from TanStack Router needs a router context. Stub it to a
// plain anchor so the tab bar can render in isolation.
vi.mock("@tanstack/react-router", async () => {
    const actual = await vi.importActual<
        typeof import("@tanstack/react-router")
    >("@tanstack/react-router");
    return {
        ...actual,
        Link: ({
            to,
            children,
            ...rest
        }: {
            to: string;
            children: React.ReactNode;
            [key: string]: unknown;
        }) => (
            <a href={to} {...rest}>
                {children}
            </a>
        ),
    };
});

const mockTabs = [
    { key: "a", label: "Tab A", icon: <span>A</span> },
    { key: "b", label: "Tab B", icon: <span>B</span> },
    { key: "c", label: "Tab C", icon: <span>C</span> },
];

describe("BottomTabBar", () => {
    it("should render all tab labels", () => {
        render(<BottomTabBar tabs={mockTabs} activeKey="a" />);
        expect(screen.getByText("Tab A")).toBeInTheDocument();
        expect(screen.getByText("Tab B")).toBeInTheDocument();
        expect(screen.getByText("Tab C")).toBeInTheDocument();
    });

    it("should render each tab as a link to its key route", () => {
        render(<BottomTabBar tabs={mockTabs} activeKey="a" />);
        const tabBLink = screen.getByText("Tab B").closest("a");
        expect(tabBLink).not.toBeNull();
        expect(tabBLink?.getAttribute("href")).toBe("b");
    });

    it("should give active tab a different className than inactive tab", () => {
        render(<BottomTabBar tabs={mockTabs} activeKey="a" />);
        const tabALink = screen.getByText("Tab A").closest("a");
        const tabBLink = screen.getByText("Tab B").closest("a");

        expect(tabALink).not.toBeNull();
        expect(tabBLink).not.toBeNull();
        expect(tabALink?.className).not.toBe(tabBLink?.className);
    });

    it("should mark active tab with aria-current='page'", () => {
        render(<BottomTabBar tabs={mockTabs} activeKey="a" />);
        const links = screen.getAllByRole("link");
        expect(links[0]).toHaveAttribute("aria-current", "page");
        expect(links[1]).not.toHaveAttribute("aria-current");
    });

    it("should render the progressive blur background", () => {
        const { container } = render(
            <BottomTabBar tabs={mockTabs} activeKey="a" />
        );

        const background = container.querySelector("[aria-hidden='true']");
        expect(background).toBeInTheDocument();
    });
});
