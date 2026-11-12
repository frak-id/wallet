import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from ".";

describe("Badge", () => {
    it("should render as span element", () => {
        const { container } = render(<Badge>Active</Badge>);
        expect(container.querySelector("span")).toBeTruthy();
    });

    it("should render children", () => {
        const { getByText } = render(<Badge variant="success">Success</Badge>);
        expect(getByText("Success")).toBeTruthy();
    });

    function hover(
        badge: Element,
        labelWidths: { scroll: number; client: number }
    ) {
        const label = badge.firstElementChild as HTMLElement;
        Object.defineProperty(label, "scrollWidth", {
            value: labelWidths.scroll,
        });
        Object.defineProperty(label, "clientWidth", {
            value: labelWidths.client,
        });
        fireEvent.pointerEnter(badge);
    }

    it("titles itself with its full text on hover when the label is truncated", () => {
        const value = 42;
        const { container } = render(
            <Badge>
                price {">"} {value}
            </Badge>
        );
        const badge = container.firstElementChild as Element;
        hover(badge, { scroll: 200, client: 50 });
        expect(badge.getAttribute("title")).toBe("price > 42");
    });

    it("has no title when the label fits, so a titled ancestor still shows", () => {
        const { container } = render(<Badge>Active</Badge>);
        const badge = container.firstElementChild as Element;
        hover(badge, { scroll: 50, client: 50 });
        expect(badge.hasAttribute("title")).toBe(false);
    });

    it("has no title when the label holds an element", () => {
        const { container } = render(
            <Badge>
                <strong>New</strong>
            </Badge>
        );
        const badge = container.firstElementChild as Element;
        hover(badge, { scroll: 200, client: 50 });
        expect(badge.hasAttribute("title")).toBe(false);
    });

    it("should forward className", () => {
        const { container } = render(<Badge className="custom">Test</Badge>);
        expect(container.querySelector(".custom")).toBeTruthy();
    });
});
