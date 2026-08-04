import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExternalLink } from "./index";

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    IS_TAURI: false,
}));

describe("ExternalLink", () => {
    it("renders an anchor for allowed schemes", () => {
        for (const href of [
            "https://example.com",
            "http://example.com",
            "mailto:hello@frak.id",
            "tel:+33123456789",
        ]) {
            const { unmount } = render(
                <ExternalLink href={href}>label</ExternalLink>
            );
            expect(screen.getByRole("link")).toHaveAttribute("href", href);
            unmount();
        }
    });

    // These all pass the backend's historic `format: "uri"` validation.
    it("renders inert text instead of a link for script-bearing schemes", () => {
        for (const href of [
            "javascript:alert(1)",
            "data:text/html;base64,PHNjcmlwdD4=",
            "vbscript:msgbox(1)",
        ]) {
            const { unmount } = render(
                <ExternalLink href={href}>label</ExternalLink>
            );
            expect(screen.queryByRole("link")).toBeNull();
            // Only the navigation is dropped; the label stays readable.
            expect(screen.getByText("label")).toBeInTheDocument();
            unmount();
        }
    });

    it("keeps relative hrefs clickable", () => {
        render(<ExternalLink href="/install">label</ExternalLink>);
        expect(screen.getByRole("link")).toHaveAttribute("href", "/install");
    });

    it("preserves className when falling back to inert text", () => {
        const href = "javascript:alert(1)";
        render(
            <ExternalLink href={href} className="merchant-link">
                label
            </ExternalLink>
        );
        expect(screen.getByText("label")).toHaveClass("merchant-link");
    });
});
