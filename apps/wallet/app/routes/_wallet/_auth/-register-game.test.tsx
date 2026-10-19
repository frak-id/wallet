/** @jsxImportSource react */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import { modalStore } from "@/module/stores/modalStore";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const { mockGame, track, referralStatus } = vi.hoisted(() => ({
    mockGame: { enabled: false, rewardEur: 1, prizeEur: 100 },
    track: vi.fn(),
    referralStatus: { data: undefined as unknown },
}));

vi.mock("@/module/game/config", () => ({ frakGame: mockGame }));

vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@tanstack/react-router")>();
    return {
        ...actual,
        useNavigate: () => vi.fn(),
        createFileRoute: () => (options: Record<string, unknown>) => ({
            options,
            useSearch: () => ({}),
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

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        trackEvent: vi.fn(),
        startFlow: () => ({ ended: false, track, end: vi.fn() }),
        useLogin: () => ({ login: vi.fn(), isLoading: false }),
        useReferralStatus: () => referralStatus,
    };
});

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

vi.mock("@/module/onboarding/component/OnboardingStep", () => ({
    OnboardingStep: ({
        hero,
        onContinue,
        onBack,
    }: {
        hero: { translationKey: string };
        onContinue: () => void;
        onBack?: () => void;
    }) => (
        <div>
            <span>step-{hero.translationKey}</span>
            <button type="button" onClick={onContinue}>
                continue
            </button>
            {onBack && (
                <button type="button" onClick={onBack}>
                    back
                </button>
            )}
        </div>
    ),
}));
vi.mock("@/module/game/component/GameRules", () => ({
    GameRules: ({ onContinue }: { onContinue: () => void }) => (
        <div>
            <span>game-rules</span>
            <button type="button" onClick={onContinue}>
                continue
            </button>
        </div>
    ),
}));
vi.mock("@/module/game/component/GameReward", () => ({
    GameReward: ({ onContinue }: { onContinue: () => void }) => (
        <div>
            <span>game-reward</span>
            <button type="button" onClick={onContinue}>
                continue
            </button>
        </div>
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
        onApplied,
        headerEnd,
    }: {
        onApplied: (result: { kind: "user" | "frak" }) => void;
        headerEnd: React.ReactNode;
    }) => (
        <div>
            <span>referral-code-step</span>
            {headerEnd}
            <button type="button" onClick={() => onApplied({ kind: "frak" })}>
                apply
            </button>
        </div>
    ),
}));
vi.mock("@/module/onboarding/component/NotificationOptIn", () => ({
    NotificationOptIn: () => <div>notification-step</div>,
}));

import { Route } from "./register";

const RegisterPage = Route.options.component as () => React.ReactElement;

const click = (name: string) =>
    fireEvent.click(screen.getByRole("button", { name }));

describe("RegisterPage — Frak Game onboarding", () => {
    beforeEach(() => {
        mockGame.enabled = false;
        modalStore.getState().dismissAll();
        pendingActionsStore.getState().clearAll();
        referralStatus.data = undefined;
        track.mockClear();
    });

    const finishKeypass = () => {
        const modal = modalStore.getState().modal;
        if (modal?.id !== "keypass") throw new Error("keypass not open");
        act(() => modal.onAuthSuccess());
    };

    const reachKeypass = () => {
        const view = render(<RegisterPage />);
        click("continue");
        click("continue");
        click("continue");
        click("continue");
        return view;
    };

    const reachReferralCode = () => {
        const view = reachKeypass();
        finishKeypass();
        expect(screen.getByText("referral-code-step")).toBeInTheDocument();
        return view;
    };

    test("flag on: an applied code leads to the reward, then the rules, then notifications", () => {
        mockGame.enabled = true;
        reachReferralCode();

        click("apply");
        expect(screen.getByText("game-reward")).toBeInTheDocument();

        click("continue");
        expect(screen.getByText("game-rules")).toBeInTheDocument();

        click("continue");
        expect(screen.getByText("notification-step")).toBeInTheDocument();
        expect(
            screen.queryByText("onboarding.referral.frakAppliedToast")
        ).not.toBeInTheDocument();
        const tracked = track.mock.calls.map(([name, props]) => [
            name,
            props?.outcome ?? props?.step,
        ]);
        expect(tracked).toContainEqual(["referral_code_resolved", "applied"]);
        expect(
            tracked.filter(([name]) => name === "referral_code_resolved")
        ).toHaveLength(1);
        expect(tracked.filter(([name]) => name === "game_step_viewed")).toEqual(
            [
                ["game_step_viewed", "reward"],
                ["game_step_viewed", "rules"],
            ]
        );
    });

    test("flag on: the status refetch landing mid-transition does not skip the game screens", () => {
        mockGame.enabled = true;
        const { rerender } = reachReferralCode();
        const pending: Array<() => void> = [];
        const startViewTransition = vi.fn((update: () => void) => {
            pending.push(update);
            return { ready: Promise.resolve(), finished: Promise.resolve() };
        });
        Object.assign(document, { startViewTransition });

        try {
            click("apply");
            referralStatus.data = { crossMerchantReferrer: "0x1" };
            rerender(<RegisterPage />);
            for (const update of pending.splice(0)) act(update);
        } finally {
            Reflect.deleteProperty(document, "startViewTransition");
        }

        expect(screen.getByText("game-reward")).toBeInTheDocument();
    });

    test("flag on: skipping the code skips the game screens", () => {
        mockGame.enabled = true;
        reachReferralCode();

        click("onboarding.skipStep");

        expect(screen.getByText("notification-step")).toBeInTheDocument();
        expect(screen.queryByText("game-reward")).not.toBeInTheDocument();
    });

    test("flag off: an applied code leads straight to notifications", () => {
        reachReferralCode();

        click("apply");

        expect(screen.getByText("notification-step")).toBeInTheDocument();
        expect(screen.queryByText("game-reward")).not.toBeInTheDocument();
        expect(
            screen.getByText("onboarding.referral.frakAppliedToast")
        ).toBeInTheDocument();
    });

    test("flag on, pairing context: no game screen between step one and welcome", () => {
        mockGame.enabled = true;
        pendingActionsStore.getState().addAction({
            type: "navigation",
            to: "/pairing",
            search: { id: "x" },
        });
        render(<RegisterPage />);

        click("continue");
        click("continue");
        finishKeypass();

        expect(screen.queryByText("game-reward")).not.toBeInTheDocument();
        expect(
            screen.getByText("onboarding.welcome.title")
        ).toBeInTheDocument();
    });
});
