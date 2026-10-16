/** @jsxImportSource react */
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createMoneriumError } from "@/module/monerium/utils/moneriumErrors";
import { describe, expect, test } from "@/tests/vitest-fixtures";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

import { MoneriumScreen } from "./MoneriumScreen";

const isDisabled = (name: string) =>
    screen.getByRole("button", { name }).hasAttribute("disabled");

describe("MoneriumScreen", () => {
    test("renders the description before the children and the error after them", () => {
        render(
            <MoneriumScreen
                onClose={vi.fn()}
                description="the description"
                error={createMoneriumError("MONERIUM_INVALID_IBAN")}
            >
                <p>the body</p>
            </MoneriumScreen>
        );

        const description = screen.getByText("the description");
        const body = screen.getByText("the body");
        const error = screen.getByText("monerium.errors.invalidIban");
        expect(
            description.compareDocumentPosition(body) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(
            body.compareDocumentPosition(error) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    test("shows no error copy without an error", () => {
        render(<MoneriumScreen onClose={vi.fn()} description="d" />);
        expect(screen.queryByText(/^monerium\.errors\./)).toBeNull();
    });

    test("busy disables both CTAs, which are enabled otherwise", () => {
        const props = {
            onClose: vi.fn(),
            ctaLabel: "primary",
            ctaOnClick: vi.fn(),
            secondaryLabel: "secondary",
            secondaryOnClick: vi.fn(),
        };
        const { rerender } = render(<MoneriumScreen {...props} />);
        expect([isDisabled("primary"), isDisabled("secondary")]).toEqual([
            false,
            false,
        ]);

        rerender(<MoneriumScreen {...props} busy />);
        expect([isDisabled("primary"), isDisabled("secondary")]).toEqual([
            true,
            true,
        ]);
    });

    test("the close button calls onClose", () => {
        const onClose = vi.fn();
        render(<MoneriumScreen onClose={onClose} />);

        fireEvent.click(screen.getByRole("button", { name: "common.close" }));
        expect(onClose).toHaveBeenCalledOnce();
    });
});
