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

vi.mock("@/module/merchant/hook/useAllowedPackageIds", () => ({
    useAddAllowedPackageId: () => ({
        mutate: mockAdd,
        isPending: false,
        error: addError,
        reset: vi.fn(),
    }),
    useRemoveAllowedPackageId: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { AllowedPackageIdsSheet } from "./index";

function openSheet() {
    render(
        <AllowedPackageIdsSheet
            merchantId="merchant-1"
            allowedPackageIds={[]}
        />
    );
    fireEvent.click(screen.getByText("merchantEdit.packageIds.manage"));
}

afterEach(() => {
    mockAdd.mockReset();
    addError = null;
});

describe("AllowedPackageIdsSheet", () => {
    test("points the merchant at support when the app is already claimed", () => {
        addError = { code: "PACKAGE_ID_ALREADY_CLAIMED" };
        openSheet();

        // Support is the only route out: the conflicting claim sits on a
        // merchant this user cannot see, let alone edit.
        expect(
            screen.getByText("hello@frak-labs.com").getAttribute("href")
        ).toBe("mailto:hello@frak-labs.com");
        expect(
            screen.queryByText("merchantEdit.packageIds.addError")
        ).toBeNull();
    });

    test("shows the generic failure for any other error, with no support link", () => {
        addError = { code: "SOMETHING_ELSE" };
        openSheet();

        expect(
            screen.getByText("merchantEdit.packageIds.addError")
        ).toBeTruthy();
        expect(screen.queryByText("hello@frak-labs.com")).toBeNull();
    });

    test("submits the lowercased package id with the selected platform", () => {
        openSheet();

        fireEvent.change(
            screen.getByPlaceholderText(
                "merchantEdit.packageIds.placeholder.android"
            ),
            { target: { value: "  Com.Example.App  " } }
        );
        fireEvent.click(screen.getByText("merchantEdit.packageIds.add"));

        expect(mockAdd).toHaveBeenCalledWith(
            { packageId: "com.example.app", platform: "android" },
            expect.anything()
        );
    });
});
