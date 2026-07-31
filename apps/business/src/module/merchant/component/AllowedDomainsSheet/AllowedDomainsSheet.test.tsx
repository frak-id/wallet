import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, vi } from "vitest";
import { describe, expect, test } from "@/tests/vitest-fixtures";

// Keys pass through as their name; `Trans` renders the element handed to its
// `support` slot, so the mailto the component builds is what gets asserted.
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    Trans: ({
        i18nKey,
        components,
    }: {
        i18nKey: string;
        components?: { support?: ReactElement<{ href?: string }> };
    }) => (
        <span>
            {i18nKey}
            {components?.support ? (
                <a href={components.support.props.href}>hello@frak-labs.com</a>
            ) : null}
        </span>
    ),
}));

const mockAdd = vi.fn();
let addError: { code: string } | null = null;

vi.mock("@/module/merchant/hook/useAllowedDomains", () => ({
    useAddAllowedDomain: () => ({
        mutate: mockAdd,
        isPending: false,
        error: addError,
        reset: vi.fn(),
    }),
    useRemoveAllowedDomain: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { AllowedDomainsSheet } from "./index";

function openSheet() {
    render(<AllowedDomainsSheet merchantId="merchant-1" allowedDomains={[]} />);
    fireEvent.click(screen.getByText("merchantEdit.domains.manage"));
}

afterEach(() => {
    mockAdd.mockReset();
    addError = null;
});

describe("AllowedDomainsSheet", () => {
    test("points the merchant at support when the domain is already claimed", () => {
        addError = { code: "DOMAIN_ALREADY_CLAIMED" };
        openSheet();

        // Support is the only route out: the conflicting claim sits on a
        // merchant this user cannot see, let alone edit.
        expect(
            screen.getByText("hello@frak-labs.com").getAttribute("href")
        ).toBe("mailto:hello@frak-labs.com");
        expect(screen.queryByText("merchantEdit.domains.addError")).toBeNull();
    });

    test("shows the generic failure for any other error, with no support link", () => {
        addError = { code: "SOMETHING_ELSE" };
        openSheet();

        expect(screen.getByText("merchantEdit.domains.addError")).toBeTruthy();
        expect(screen.queryByText("hello@frak-labs.com")).toBeNull();
    });

    test("submits the normalized domain", () => {
        openSheet();

        fireEvent.change(
            screen.getByPlaceholderText("merchantEdit.domains.placeholder"),
            { target: { value: "  https://www.Example.com/  " } }
        );
        fireEvent.click(screen.getByText("merchantEdit.domains.add"));

        expect(mockAdd).toHaveBeenCalledWith("example.com", expect.anything());
    });
});
