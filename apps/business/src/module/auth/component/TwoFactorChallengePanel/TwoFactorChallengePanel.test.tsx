import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { describe, expect, test } from "@/tests/vitest-fixtures";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => mockNavigate,
}));

const mockEnrolledMethods = vi.fn();
vi.mock("@/module/auth/hooks/useTwoFactorChallenge", () => ({
    useEnrolledTwoFactorMethods: () => mockEnrolledMethods(),
    useTwoFactorChallenge: () => ({ mutate: vi.fn() }),
    useTwoFactorVerify: () => ({ mutate: vi.fn() }),
}));

import { TwoFactorChallengePanel } from "./index";

describe("TwoFactorChallengePanel — no enrolled methods", () => {
    test("shows the Settings fallback instead of an empty challenge", () => {
        mockEnrolledMethods.mockReturnValue({ data: [], isLoading: false });
        const onDismiss = vi.fn();

        render(
            <TwoFactorChallengePanel
                methods={[]}
                onVerified={vi.fn()}
                onDismiss={onDismiss}
            />
        );

        expect(
            screen.getByText("auth.twoFactor.noMethods.description")
        ).toBeInTheDocument();

        fireEvent.click(screen.getByText("auth.twoFactor.noMethods.cta"));
        expect(onDismiss).toHaveBeenCalledOnce();
        expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
    });

    test("does not show the fallback while methods are still loading", () => {
        mockEnrolledMethods.mockReturnValue({
            data: undefined,
            isLoading: true,
        });

        render(
            <TwoFactorChallengePanel methods={["email"]} onVerified={vi.fn()} />
        );

        expect(
            screen.queryByText("auth.twoFactor.noMethods.cta")
        ).not.toBeInTheDocument();
    });
});
