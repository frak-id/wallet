import type { RedeemResult } from "@frak-labs/wallet-shared";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedeemReferralCodePage } from "./index";

const mockUseReferralStatus = vi.fn();
const { formOptions, navigate, invalidateQueries, refetchQueries } = vi.hoisted(
    () => ({
        formOptions: {
            current: undefined as
                | { onApplied?: (result: RedeemResult) => void }
                | undefined,
        },
        navigate: vi.fn(),
        invalidateQueries: vi.fn(() => Promise.resolve()),
        refetchQueries: vi.fn(() => Promise.resolve()),
    })
);

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
        useRedeemReferralCodeForm: (options: typeof formOptions.current) => {
            formOptions.current = options;
            return {
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
            };
        },
    };
});

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => navigate,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "en-US" },
    }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@tanstack/react-query")>()),
    useQueryClient: () => ({ invalidateQueries, refetchQueries }),
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

    it("goes to the game page once a code joined the game", async () => {
        mockUseReferralStatus.mockReturnValue({
            data: { crossMerchantReferrer: null },
        });
        render(<RedeemReferralCodePage initialCode="LOLA10" />);

        formOptions.current?.onApplied?.({
            kind: "user",
            game: { id: "g1" },
        } as RedeemResult);

        await waitFor(() =>
            expect(navigate).toHaveBeenCalledWith({
                to: "/game",
                replace: true,
            })
        );
        expect(refetchQueries).toHaveBeenCalledWith({
            queryKey: ["game", "current"],
        });
    });

    it("stays on the page when no game came back", async () => {
        mockUseReferralStatus.mockReturnValue({
            data: { crossMerchantReferrer: null },
        });
        render(<RedeemReferralCodePage initialCode="LOLA10" />);

        formOptions.current?.onApplied?.({ kind: "user" });

        await waitFor(() => expect(invalidateQueries).toHaveBeenCalled());
        expect(navigate).not.toHaveBeenCalled();
    });
});
