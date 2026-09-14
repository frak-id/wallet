import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bottomTabBarStyles } from "./bottomTabBar.css";
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

    it("should mark active tab with aria-current='page'", () => {
        render(<BottomTabBar tabs={mockTabs} activeKey="a" />);
        const links = screen.getAllByRole("link");
        expect(links[0]).toHaveAttribute("aria-current", "page");
        expect(links[1]).not.toHaveAttribute("aria-current");
    });

    // Active variants compose their base; replacing it would drop layout.
    it("should render the active tab with its base classes applied", () => {
        render(<BottomTabBar tabs={mockTabs} activeKey="a" />);
        const [activeLink, inactiveLink] = screen.getAllByRole("link");

        expect(activeLink.className).toContain(bottomTabBarStyles.tab);
        expect(activeLink.className).toContain(bottomTabBarStyles.tabActive);
        expect(inactiveLink.className).not.toContain(
            bottomTabBarStyles.tabActive
        );

        const activeIcon = activeLink.querySelector("span");
        expect(activeIcon?.className).toContain(
            bottomTabBarStyles.tabIconWrapper
        );
        expect(activeIcon?.className).toContain(
            bottomTabBarStyles.tabIconWrapperActive
        );
    });

    // The glider must span a whole tab and step by exactly one tab width, or
    // the highlight drifts off-centre on the outer tabs.
    it("should size and step the glider by one full tab", () => {
        const { container } = render(
            <BottomTabBar tabs={mockTabs} activeKey="c" />
        );

        const glider = container.querySelector<HTMLElement>(
            `.${bottomTabBarStyles.glider}`
        );
        expect(glider?.style.width).toBe("calc(33.3333%)");
        expect(glider?.style.transform).toBe("translateX(200%)");
    });
});
