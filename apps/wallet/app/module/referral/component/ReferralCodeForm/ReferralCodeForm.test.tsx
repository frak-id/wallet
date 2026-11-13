import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferralCodeForm } from "./index";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared", () => {
    const mutation = () => ({
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
        reset: vi.fn(),
        isPending: false,
        error: null,
        data: undefined,
    });
    return {
        useSuggestReferralCodes: mutation,
        useIssueReferralCode: mutation,
        useReplaceReferralCode: mutation,
        resolveApiErrorKey: () => null,
    };
});

describe("ReferralCodeForm", () => {
    it("names the code field by its visible label", () => {
        render(<ReferralCodeForm />);

        expect(
            screen.getByLabelText("wallet.referral.create.label")
        ).toHaveAttribute("placeholder", "wallet.referral.create.placeholder");
    });
});
