/** @jsxImportSource react */
import { render, waitFor } from "@testing-library/react";
// `vi` must come from "vitest" directly: `vi.mock` is hoisted above module imports.
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const { mockNavigate, mockSearch, mockReferrerCode, loginOptions } = vi.hoisted(
    () => ({
        mockNavigate: vi.fn(),
        mockSearch: { current: {} as { ref?: string } },
        mockReferrerCode: { current: undefined as string | undefined },
        loginOptions: { current: null as { onSuccess: () => unknown } | null },
    })
);

vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@tanstack/react-router")>();
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        createFileRoute: () => (options: Record<string, unknown>) => ({
            options,
            useSearch: () => mockSearch.current,
        }),
    };
});

vi.mock("@/module/game/config", () => ({ frakGame: { enabled: true } }));

vi.mock("@/module/onboarding/hook/useInstallReferrer", () => ({
    useInstallReferrer: () => ({
        data: mockReferrerCode.current
            ? { referralCode: mockReferrerCode.current }
            : null,
    }),
}));

vi.mock("@/module/onboarding/hook/usePushOptIn", () => ({
    usePushOptIn: () => ({ onEnable: vi.fn(), onSkip: vi.fn() }),
}));

vi.mock("@/module/pending-actions/hook/useExecutePendingActions", () => ({
    useExecutePendingActions: () => ({
        executePendingActions: vi.fn().mockResolvedValue(false),
    }),
}));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        trackEvent: vi.fn(),
        startFlow: () => ({
            ended: false,
            track: vi.fn(),
            end: vi.fn(),
            reopen: vi.fn(),
        }),
        useLogin: (options: { onSuccess: () => unknown }) => {
            loginOptions.current = options;
            return { login: vi.fn(), isLoading: false };
        },
        useReferralStatus: () => ({ data: undefined }),
    };
});

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

vi.mock("@/module/onboarding/component/OnboardingStep", () => ({
    OnboardingStep: () => <div>onboarding-step</div>,
}));

import { Route } from "./register";

const RegisterPage = Route.options.component as () => React.ReactElement;

async function loginFromOnboarding() {
    render(<RegisterPage />);
    await waitFor(() => expect(loginOptions.current).not.toBeNull());
    await loginOptions.current?.onSuccess();
}

describe("RegisterPage — logging in from onboarding", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loginOptions.current = null;
        mockSearch.current = {};
        mockReferrerCode.current = undefined;
    });

    test("keeps a code from the link", async () => {
        mockSearch.current = { ref: "FRAKPA" };
        await loginFromOnboarding();
        expect(mockNavigate).toHaveBeenCalledWith({
            to: "/game/join",
            search: { code: "FRAKPA" },
            replace: true,
        });
    });

    test("keeps a code from the Play install referrer", async () => {
        mockReferrerCode.current = "FRAKPA";
        await loginFromOnboarding();
        expect(mockNavigate).toHaveBeenCalledWith({
            to: "/game/join",
            search: { code: "FRAKPA" },
            replace: true,
        });
    });

    test("without a code, lands on the wallet", async () => {
        await loginFromOnboarding();
        expect(mockNavigate).toHaveBeenCalledWith({
            to: "/wallet",
            replace: true,
        });
    });
});
