import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { EditReferralCodeSheet } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    Trans: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

// The form pulls in many side-effectful hooks (suggest / issue / replace).
// The cancel flow doesn't depend on any of that, so stub the form to a
// simple marker.
vi.mock("../ReferralCodeForm", () => ({
    ReferralCodeForm: () => <div data-testid="form-stub" />,
}));

const renderSheet = (overrides?: {
    onClose?: () => void;
    onSaved?: () => void;
}) => {
    const onClose = overrides?.onClose ?? vi.fn();
    const onSaved = overrides?.onSaved ?? vi.fn();
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
            mutations: { retry: false },
        },
    });
    const utils = render(
        <QueryClientProvider client={client}>
            <EditReferralCodeSheet onClose={onClose} onSaved={onSaved} />
        </QueryClientProvider>
    );
    const sheet = within(utils.container);
    return { ...utils, sheet, onClose, onSaved };
};

describe.sequential("EditReferralCodeSheet", () => {
    it("renders the title, attention block and form", () => {
        const { sheet } = renderSheet();
        expect(sheet.getByText("wallet.referral.edit.title")).toBeTruthy();
        expect(
            sheet.getByText("wallet.referral.edit.attentionTitle")
        ).toBeTruthy();
        expect(
            sheet.getByText("wallet.referral.edit.attentionBody")
        ).toBeTruthy();
        expect(sheet.getByTestId("form-stub")).toBeTruthy();
    });

    it("does NOT close immediately when the X is clicked — opens the cancel modal", () => {
        const onClose = vi.fn();
        const { sheet } = renderSheet({ onClose });

        // The X is the only `common.close` button rendered by the sheet
        // (the cancel modal isn't open yet).
        fireEvent.click(sheet.getByRole("button", { name: "common.close" }));

        // onClose must NOT have been called — the cancel-confirm modal opens
        // first (its title appears in the document via Radix portal).
        expect(onClose).not.toHaveBeenCalled();
        expect(
            document.body.textContent?.includes(
                "wallet.referral.edit.cancelConfirm.title"
            )
        ).toBe(true);
    });

    it("opens the cancel modal when the Annuler header link is clicked", () => {
        const onClose = vi.fn();
        const { sheet } = renderSheet({ onClose });

        fireEvent.click(sheet.getByText("wallet.referral.edit.cancel"));

        expect(onClose).not.toHaveBeenCalled();
        expect(
            document.body.textContent?.includes(
                "wallet.referral.edit.cancelConfirm.title"
            )
        ).toBe(true);
    });

    it("closes the sheet when the cancel modal's confirm CTA is clicked", () => {
        const onClose = vi.fn();
        const { sheet } = renderSheet({ onClose });

        // Open the cancel modal.
        fireEvent.click(sheet.getByRole("button", { name: "common.close" }));

        // The modal renders into a Radix portal in document.body. Pick the
        // confirm CTA by its exact accessible name.
        const allButtons = Array.from(
            document.body.querySelectorAll<HTMLButtonElement>("button")
        );
        const confirmCta = allButtons.find(
            (btn) =>
                btn.textContent ===
                "wallet.referral.edit.cancelConfirm.confirmCta"
        );
        expect(confirmCta).toBeTruthy();
        fireEvent.click(confirmCta as HTMLButtonElement);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("keeps the sheet open when the cancel modal's continue CTA is clicked", () => {
        const onClose = vi.fn();
        const { sheet } = renderSheet({ onClose });

        fireEvent.click(sheet.getByRole("button", { name: "common.close" }));

        const allButtons = Array.from(
            document.body.querySelectorAll<HTMLButtonElement>("button")
        );
        const continueCta = allButtons.find(
            (btn) =>
                btn.textContent ===
                "wallet.referral.edit.cancelConfirm.continueCta"
        );
        expect(continueCta).toBeTruthy();
        fireEvent.click(continueCta as HTMLButtonElement);

        expect(onClose).not.toHaveBeenCalled();
    });
});
