import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteRedemptionConfirmModal } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe("DeleteRedemptionConfirmModal", () => {
    it("renders the title, description, and both CTAs when open", () => {
        render(
            <DeleteRedemptionConfirmModal
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
            />
        );

        // Title + description appear twice each: once visible, once
        // inside Radix's visually-hidden DialogTitle / DialogDescription
        // for screen readers. Both copies are intentional.
        expect(
            screen.getAllByText("wallet.referral.redeem.confirmDelete.title")
                .length
        ).toBeGreaterThan(0);
        expect(
            screen.getAllByText(
                "wallet.referral.redeem.confirmDelete.description"
            ).length
        ).toBeGreaterThan(0);
        expect(
            screen.getByRole("button", {
                name: "wallet.referral.redeem.confirmDelete.confirmCta",
            })
        ).toBeTruthy();
        expect(
            screen.getByRole("button", {
                name: "wallet.referral.redeem.confirmDelete.cancelCta",
            })
        ).toBeTruthy();
    });

    it("calls onConfirm when the destructive button is clicked", () => {
        const onConfirm = vi.fn();
        render(
            <DeleteRedemptionConfirmModal
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={onConfirm}
            />
        );

        fireEvent.click(
            screen.getByRole("button", {
                name: "wallet.referral.redeem.confirmDelete.confirmCta",
            })
        );

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("blocks dismissal while the mutation is pending", () => {
        const onOpenChange = vi.fn();
        render(
            <DeleteRedemptionConfirmModal
                open={true}
                onOpenChange={onOpenChange}
                onConfirm={vi.fn()}
                isPending={true}
            />
        );

        const cancel = screen.getByRole("button", {
            name: "wallet.referral.redeem.confirmDelete.cancelCta",
        });
        const close = screen.getByRole("button", { name: "common.close" });

        expect(cancel).toBeDisabled();
        expect(close).toBeDisabled();

        fireEvent.click(cancel);
        fireEvent.click(close);

        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("renders the resolved error message when errorMessageKey is set", () => {
        render(
            <DeleteRedemptionConfirmModal
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
                errorMessageKey="wallet.referral.redeem.errorGeneric"
            />
        );

        expect(
            screen.getByText("wallet.referral.redeem.errorGeneric")
        ).toBeTruthy();
    });
});
