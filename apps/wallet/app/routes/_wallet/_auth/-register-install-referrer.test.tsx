/** @jsxImportSource react */
import { render, waitFor } from "@testing-library/react";
// `vi` must come from "vitest" directly: `vi.mock` is hoisted above module
// imports, so routing it through the fixtures module would reference an
// uninitialized binding.
import { vi } from "vitest";
import { modalStore } from "@/module/stores/modalStore";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

type ReferrerData = { merchant?: { name: string; domain: string } } | null;

const { mockNavigate, mockReferrerData } = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockReferrerData: { current: null as ReferrerData },
}));

// `Route.useSearch()` reads the router context, which no bare `render` has.
// Mocking the factory keeps `Route.options.component` reachable without
// standing up a `RouterProvider` for a test about a modal.
vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@tanstack/react-router")>();
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        createFileRoute: () => (options: Record<string, unknown>) => ({
            options,
            useSearch: () => ({}),
        }),
    };
});

vi.mock("@/module/onboarding/hook/useInstallReferrer", () => ({
    useInstallReferrer: () => ({ data: mockReferrerData.current }),
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
        startFlow: () => ({ ended: false, track: vi.fn(), end: vi.fn() }),
        useLogin: () => ({ login: vi.fn(), isLoading: false }),
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
vi.mock("@/module/onboarding/component/EmailInputStep", () => ({
    EmailInputStep: () => <div>email-input-step</div>,
}));
vi.mock("@/module/onboarding/component/EmailAlreadyUsedStep", () => ({
    EmailAlreadyUsedStep: () => <div>email-already-used-step</div>,
}));
vi.mock("@/module/onboarding/component/ReferralCodeStep", () => ({
    ReferralCodeStep: () => <div>referral-code-step</div>,
}));
vi.mock("@/module/onboarding/component/NotificationOptIn", () => ({
    NotificationOptIn: () => <div>notification-opt-in</div>,
}));
vi.mock("@/module/onboarding/component/Welcome", () => ({
    Welcome: () => <div>welcome</div>,
}));

import { Route } from "./register";

const RegisterPage = Route.options.component as () => React.ReactElement;

const merchant = { name: "Ethcc Frak", domain: "ethcc.test" };

describe("RegisterPage — install-referrer confirmation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        modalStore.getState().dismissAll();
    });

    /**
     * One test, not three: the announcement latch is module-scoped because it
     * is owed once per app launch, so splitting these phases would make each
     * depend on the one before it having already spent the latch.
     *
     * Regression — this exact sequence used to trap the user in a loop:
     * dismissing announced a `/register` self-navigation, which re-ran
     * `beforeLoad` without `new` and redirected to `/login`; backing out of
     * `/login` re-mounted this route, whose `staleTime: Infinity` referrer
     * query re-announced the same modal.
     */
    test("announces once per launch, owns no exit, and never re-announces", async () => {
        mockReferrerData.current = { merchant };

        const first = render(<RegisterPage />);

        await waitFor(() =>
            expect(modalStore.getState().modal?.id).toBe("recoveryCodeSuccess")
        );
        const modal = modalStore.getState().modal;
        if (modal?.id !== "recoveryCodeSuccess") throw new Error("no modal");
        expect(modal.merchant?.name).toBe(merchant.name);
        expect(modal.onExit).toBeUndefined();

        modalStore.getState().closeModal();
        await Promise.resolve();
        expect(modalStore.getState().modal).toBeNull();
        expect(mockNavigate).not.toHaveBeenCalled();

        // Coming back from `/login`: the referrer query is cached at
        // `staleTime: Infinity`, so its data is there synchronously here.
        first.unmount();
        render(<RegisterPage />);
        await Promise.resolve();

        expect(modalStore.getState().modal).toBeNull();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    test("no referrer means no announcement", async () => {
        mockReferrerData.current = null;

        render(<RegisterPage />);
        await Promise.resolve();

        expect(modalStore.getState().modal).toBeNull();
    });
});
