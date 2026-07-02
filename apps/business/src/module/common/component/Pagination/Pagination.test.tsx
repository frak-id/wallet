import { visuallyHidden } from "@frak-labs/design-system/utils";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaginationEllipsis } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

describe("PaginationEllipsis", () => {
    it("hides the caption visually via the DS visuallyHidden class", () => {
        render(<PaginationEllipsis />);

        const caption = screen.getByText("common.pagination.morePages");
        expect(caption.className.split(" ")).toContain(visuallyHidden);
    });

    it("marks the whole ellipsis aria-hidden (icon is decorative)", () => {
        const { container } = render(<PaginationEllipsis />);

        expect(container.querySelector("[aria-hidden]")).not.toBeNull();
    });
});
