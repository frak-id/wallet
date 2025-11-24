import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Navigation } from "./index";

vi.mock("../NavigationItem", () => ({
    NavigationItem: ({ children, url }: any) => (
        <li>
            <a href={url}>{children}</a>
        </li>
    ),
}));

describe("Navigation", () => {
    it("should render navigation with wallet link", () => {
        render(<Navigation />);

        const links = screen.getAllByRole("link");
        const walletLink = links.find(
            (link) => link.getAttribute("href") === "/wallet"
        );
        expect(walletLink).toBeInTheDocument();
        expect(walletLink).toHaveAttribute("href", "/wallet");
    });

    it("should render navigation with history link", () => {
        render(<Navigation />);

        const links = screen.getAllByRole("link");
        const historyLink = links.find(
            (link) => link.getAttribute("href") === "/history"
        );
        expect(historyLink).toBeInTheDocument();
    });

    it("should render navigation with settings link", () => {
        render(<Navigation />);

        const links = screen.getAllByRole("link");
        const settingsLink = links.find(
            (link) => link.getAttribute("href") === "/settings"
        );
        expect(settingsLink).toBeInTheDocument();
    });

    it("should render as nav element", () => {
        const { container } = render(<Navigation />);

        const nav = container.querySelector("nav");
        expect(nav).toBeInTheDocument();
    });

    it("should render navigation list", () => {
        const { container } = render(<Navigation />);

        const list = container.querySelector("ul");
        expect(list).toBeInTheDocument();
    });
});
