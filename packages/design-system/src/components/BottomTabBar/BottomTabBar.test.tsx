import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomTabBar } from "./index";

const mockTabs = [
    { key: "a", label: "Tab A", icon: <span>A</span> },
    { key: "b", label: "Tab B", icon: <span>B</span> },
    { key: "c", label: "Tab C", icon: <span>C</span> },
];

describe("BottomTabBar", () => {
    it("should render all tab labels", () => {
        render(
            <BottomTabBar tabs={mockTabs} activeKey="a" onTabChange={vi.fn()} />
        );
        expect(screen.getByText("Tab A")).toBeInTheDocument();
        expect(screen.getByText("Tab B")).toBeInTheDocument();
        expect(screen.getByText("Tab C")).toBeInTheDocument();
    });

    it("should call onTabChange with the tab key when inactive tab clicked", () => {
        const handleChange = vi.fn();
        render(
            <BottomTabBar
                tabs={mockTabs}
                activeKey="a"
                onTabChange={handleChange}
            />
        );
        const btn = screen.getByText("Tab B").closest("button");
        if (btn) fireEvent.click(btn);
        expect(handleChange).toHaveBeenCalledWith("b");
    });

    it("should give active tab a different className than inactive tab", () => {
        render(
            <BottomTabBar tabs={mockTabs} activeKey="a" onTabChange={vi.fn()} />
        );
        const tabALabel = screen.getByText("Tab A");
        const tabBLabel = screen.getByText("Tab B");

        // Active and inactive labels should have different classes
        expect(tabALabel.className).not.toBe(tabBLabel.className);
    });

    it("should mark active tab with aria-current='page'", () => {
        render(
            <BottomTabBar tabs={mockTabs} activeKey="a" onTabChange={vi.fn()} />
        );
        const buttons = screen.getAllByRole("button");
        expect(buttons[0]).toHaveAttribute("aria-current", "page");
        expect(buttons[1]).not.toHaveAttribute("aria-current");
    });
});
