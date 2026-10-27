import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedeemReferralCodePage } from "./index";

const mockUseReferralStatus = vi.fn();

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        useReferralStatus: () => mockUseReferralStatus(),
        useUnredeemReferralCode: () => ({
            mutate: vi.fn(),
            reset: vi.fn(),
            isPending: false,
            error: null,
        }),
        useRedeemReferralCodeForm: () => ({
            code: "",
            hasValue: false,
            canSubmit: false,
            isPending: false,
            errorMessageKey: null,
            handleChange: vi.fn(),
            handleClear: vi.fn(),
            handleSubmit: vi.fn(),
            confirmingFrakReplace: false,
            confirmFrakReplace: vi.fn(),
            cancelFrakReplace: vi.fn(),
        }),
    };
});

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "en-US" },
    }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@tanstack/react-query")>()),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("../ReferralPageShell", () => ({
    ReferralPageShell: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}));

const referrer = (isFrak: boolean) => ({
    crossMerchantReferrer: {
        code: isFrak ? "STORY1" : "LOLA10",
        since: "2026-10-20T10:00:00.000Z",
        isFrak,
    },
});

describe("RedeemReferralCodePage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows the code form under an active Frak code", () => {
        mockUseReferralStatus.mockReturnValue({ data: referrer(true) });

        render(<RedeemReferralCodePage />);

        expect(screen.getByText("STORY1")).toBeInTheDocument();
        expect(
            screen.getByRole("textbox", {
                name: "wallet.referral.redeem.label",
            })
        ).toBeInTheDocument();
    });

    it("hides the code form under a friend's active code", () => {
        mockUseReferralStatus.mockReturnValue({ data: referrer(false) });

        render(<RedeemReferralCodePage />);

        expect(screen.getByText("LOLA10")).toBeInTheDocument();
        expect(
            screen.queryByRole("textbox", {
                name: "wallet.referral.redeem.label",
            })
        ).not.toBeInTheDocument();
    });

    it("shows only the code form without a referrer", () => {
        mockUseReferralStatus.mockReturnValue({
            data: { crossMerchantReferrer: null },
        });

        render(<RedeemReferralCodePage />);

        expect(
            screen.getByRole("textbox", {
                name: "wallet.referral.redeem.label",
            })
        ).toBeInTheDocument();
        expect(
            screen.queryByText("wallet.referral.redeem.deleteCta")
        ).not.toBeInTheDocument();
    });
});
