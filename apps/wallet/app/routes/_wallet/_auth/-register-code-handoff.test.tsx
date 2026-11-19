/** @jsxImportSource react */
import { act, fireEvent, render, screen } from "@testing-library/react";
// `vi` must come from "vitest" directly: `vi.mock` is hoisted above module imports.
import { vi } from "vitest";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import { modalStore } from "@/module/stores/modalStore";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

type Merchant = { name: string; domain: string };

const { track, search, installFallback } = vi.hoisted(() => ({
    track: vi.fn(),
    search: { current: {} as Record<string, unknown> },
    installFallback: {
        onResolved: undefined as ((merchant: Merchant) => void) | undefined,
    },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@tanstack/react-router")>();
    return {
        ...actual,
        useNavigate: () => vi.fn(),
        createFileRoute: () => (options: Record<string, unknown>) => ({
            options,
            useSearch: () => search.current,
        }),
    };
});

vi.mock("@/module/onboarding/hook/useInstallReferrer", () => ({
    useInstallReferrer: () => ({ data: null }),
}));
vi.mock("@/module/onboarding/hook/usePushOptIn", () => ({
    usePushOptIn: () => ({ onEnable: vi.fn(), onSkip: vi.fn() }),
}));
vi.mock("@/module/pending-actions/hook/useExecutePendingActions", () => ({
    useExecutePendingActions: () => ({
        executePendingActions: vi.fn().mockResolvedValue(false),
    }),
}));
vi.mock("@/module/reward-code/hook/useInstallCodeFallback", () => ({
    useInstallCodeFallback: (onResolved: (merchant: Merchant) => void) => {
        installFallback.onResolved = onResolved;
        return vi.fn();
    },
}));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        trackEvent: vi.fn(),
        startFlow: () => ({
            ended: false,
            track,
            end: vi.fn(),
            reopen: vi.fn(),
        }),
        useLogin: () => ({ login: vi.fn(), isLoading: false }),
        useReferralStatus: () => ({ data: undefined }),
    };
});

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

vi.mock("@/module/onboarding/component/OnboardingStep", () => ({
    OnboardingStep: ({ onContinue }: { onContinue: () => void }) => (
        <button type="button" onClick={onContinue}>
            continue
        </button>
    ),
}));
vi.mock("@/module/onboarding/component/EmailInputStep", () => ({
    EmailInputStep: ({
        onContinue,
    }: {
        onContinue: (value: string) => void;
    }) => (
        <button type="button" onClick={() => onContinue("")}>
            continue
        </button>
    ),
}));
vi.mock("@/module/onboarding/component/ReferralCodeStep", () => ({
    ReferralCodeStep: ({
        initialCode,
        onUnknownCode,
        headerEnd,
    }: {
        initialCode?: string;
        onUnknownCode?: unknown;
        headerEnd: React.ReactNode;
    }) => (
        <div>
            <span>referral-code-step</span>
            <span>prefill-{initialCode ?? "none"}</span>
            {onUnknownCode ? <span>has-install-fallback</span> : null}
            {headerEnd}
        </div>
    ),
}));
vi.mock("@/module/onboarding/component/NotificationOptIn", () => ({
    NotificationOptIn: () => <span>notification-step</span>,
}));

import { Route } from "./register";

const RegisterPage = Route.options.component as () => React.ReactElement;

const merchant = { name: "Acme", domain: "acme.test" };

const reachReferralCode = (continues = 4) => {
    render(<RegisterPage />);
    for (let i = 0; i < continues; i++) {
        fireEvent.click(screen.getByRole("button", { name: "continue" }));
    }
    const modal = modalStore.getState().modal;
    if (modal?.id !== "keypass") throw new Error("keypass not open");
    act(() => modal.onAuthSuccess());
    expect(screen.getByText("referral-code-step")).toBeInTheDocument();
};

describe("RegisterPage — codes typed in the wrong field", () => {
    beforeEach(() => {
        modalStore.getState().dismissAll();
        pendingActionsStore.getState().clearAll();
        search.current = {};
        installFallback.onResolved = undefined;
        track.mockClear();
    });

    test("a referral code from /reward-code skips the slides and is prefilled in the referral step", () => {
        search.current = { ref: "RJFK56", refSource: "reward_code" };

        // Email step, then secure-space step: the two marketing slides are gone.
        reachReferralCode(2);
        expect(screen.getByText("prefill-RJFK56")).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", { name: "onboarding.skipStep" })
        );
        expect(track).toHaveBeenCalledWith("referral_code_resolved", {
            outcome: "skipped",
            prefill_source: "reward_code",
        });
    });

    test("an install code in the referral step announces its merchant and moves on", () => {
        reachReferralCode();
        expect(screen.getByText("has-install-fallback")).toBeInTheDocument();

        act(() => installFallback.onResolved?.(merchant));

        const modal = modalStore.getState().modal;
        expect(modal?.id).toBe("rewardCodeSuccess");
        if (modal?.id !== "rewardCodeSuccess") return;
        expect(modal.merchant).toEqual(merchant);
        expect(modal.onExit).toBeUndefined();
        expect(screen.getByText("notification-step")).toBeInTheDocument();
        expect(track).toHaveBeenCalledWith("referral_code_resolved", {
            outcome: "install_code",
            prefill_source: "none",
        });
    });

    test("an install code resolving after a skip leaves the flow alone", () => {
        reachReferralCode();
        fireEvent.click(
            screen.getByRole("button", { name: "onboarding.skipStep" })
        );
        track.mockClear();

        act(() => installFallback.onResolved?.(merchant));

        expect(modalStore.getState().modal).toBeNull();
        expect(track).not.toHaveBeenCalled();
    });
});
