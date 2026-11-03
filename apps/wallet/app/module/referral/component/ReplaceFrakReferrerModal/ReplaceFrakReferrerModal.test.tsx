import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReplaceFrakReferrerModal } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const confirmCta = { name: "wallet.referral.redeem.replaceFrak.confirmCta" };
const cancelCta = { name: "wallet.referral.redeem.replaceFrak.cancelCta" };

describe("ReplaceFrakReferrerModal", () => {
    it("replaces Frak on confirm and backs out on cancel", () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();
        render(
            <ReplaceFrakReferrerModal
                open={true}
                onConfirm={onConfirm}
                onCancel={onCancel}
            />
        );

        fireEvent.click(screen.getByRole("button", confirmCta));
        fireEvent.click(screen.getByRole("button", cancelCta));

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("cannot be backed out of while the replacement runs", () => {
        const onCancel = vi.fn();
        render(
            <ReplaceFrakReferrerModal
                open={true}
                onConfirm={vi.fn()}
                onCancel={onCancel}
                isPending={true}
            />
        );

        fireEvent.click(screen.getByRole("button", cancelCta));
        fireEvent.click(screen.getByRole("button", { name: "common.close" }));

        expect(onCancel).not.toHaveBeenCalled();
    });
});
