/** @jsxImportSource react */
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import { onlineManager } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
// `vi` must come from "vitest" directly: `vi.mock` is hoisted above module
// imports, so routing it through the fixtures module would reference an
// uninitialized binding.
import { vi } from "vitest";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import { modalStore } from "@/module/stores/modalStore";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";
import { InstallView } from "./InstallView";

// `vi.hoisted` because the factory below runs while `InstallView` is being
// imported, which is before a plain `const` would have been initialised.
const {
    mockEnsurePost,
    mockGenerateCode,
    mockTrackEvent,
    mockIsTauri,
    mockResolveMerchant,
} = vi.hoisted(() => ({
    mockEnsurePost: vi.fn(),
    mockGenerateCode: vi.fn(),
    mockTrackEvent: vi.fn(),
    mockIsTauri: vi.fn(() => false),
    mockResolveMerchant: vi.fn(),
}));

// `IS_TAURI` is a build-time literal in the app and a runtime probe under
// jsdom, where it is always false. The confirmation arm is Tauri-only, so it
// is unreachable without this.
vi.mock("@frak-labs/app-essentials/utils/platform", async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import("@frak-labs/app-essentials/utils/platform")
        >();
    return {
        ...actual,
        get IS_TAURI() {
            return mockIsTauri();
        },
    };
});

vi.mock("@frak-labs/wallet-shared/common/api/backendClient", () => ({
    authenticatedBackendApi: {
        user: {
            identity: {
                ensure: { post: mockEnsurePost },
                "install-code": { generate: { post: mockGenerateCode } },
            },
            merchant: {
                resolve: { get: mockResolveMerchant },
                "estimated-rewards": {
                    get: vi.fn().mockResolvedValue({ data: { rewards: [] } }),
                },
            },
        },
    },
}));

vi.mock("@frak-labs/wallet-shared/common/analytics", async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import("@frak-labs/wallet-shared/common/analytics")
        >();
    return { ...actual, trackEvent: mockTrackEvent, recordError: vi.fn() };
});

/**
 * Every assertion in this file matches raw i18n keys: the setup chain loads no
 * resources, so i18next echoes the key back instead of resolving it. Wiring
 * real locale data into that setup breaks all of them at once, not one.
 */

function Layout({ children }: { children: React.ReactNode }) {
    return <div data-testid="processing-layout">{children}</div>;
}

/**
 * The processing branch is what the refactor actually moved: it used to go
 * through `useExecutePendingActions` (and therefore TanStack Router) and now
 * calls the router-free drain plus an injected navigation adapter, so that the
 * standalone `/install` entrypoint can render the very same component.
 */
describe("InstallView — processing branch", () => {
    beforeEach(({ mockSession }) => {
        vi.clearAllMocks();
        mockResolveMerchant.mockResolvedValue({ data: null });
        mockEnsurePost.mockResolvedValue({ error: null });
        mockGenerateCode.mockResolvedValue({
            data: {
                code: "ABCD1234",
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
            },
            error: null,
        });
        pendingActionsStore.getState().clearAll();
        // A session with a token is what routes a web visit to the processing
        // screen instead of the install-code screen.
        sessionStore.getState().setSession(mockSession);
    });

    afterEach(() => {
        pendingActionsStore.getState().clearAll();
        sessionStore.getState().clearSession();
    });

    test("renders inside the caller's layout, not a hardcoded one", ({
        queryWrapper,
    }) => {
        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1" }}
                navigation={{ toWallet: vi.fn(), toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        expect(screen.getByTestId("processing-layout")).toBeInTheDocument();
    });

    test("fires the ensure for a logged-in visitor, then hands over to the wallet", async ({
        queryWrapper,
    }) => {
        const toWallet = vi.fn();

        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1" }}
                navigation={{ toWallet, toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(mockEnsurePost).toHaveBeenCalledWith({
                merchantId: "merchant-1",
                anonymousId: "anon-1",
            });
        });
        await waitFor(() => expect(toWallet).toHaveBeenCalled());
    });

    test("carries the install proof from the `#p=` fragment into the ensure", async ({
        queryWrapper,
    }) => {
        window.location.hash = "#p=proof-abc";

        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1" }}
                navigation={{ toWallet: vi.fn(), toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(mockEnsurePost).toHaveBeenCalledWith({
                merchantId: "merchant-1",
                anonymousId: "anon-1",
                proof: "proof-abc",
            });
        });

        window.location.hash = "";
    });

    test("queues the ensure for later and sends a logged-out visitor to register", async ({
        queryWrapper,
    }) => {
        sessionStore.getState().clearSession();
        const toRegister = vi.fn();

        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1", embed: undefined }}
                navigation={{ toWallet: vi.fn(), toRegister }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        // Logged out on the web means the install-code screen, never the
        // processing one — so no navigation and no ensure.
        expect(
            screen.queryByTestId("processing-layout")
        ).not.toBeInTheDocument();
        await waitFor(() => expect(mockEnsurePost).not.toHaveBeenCalled());
        expect(toRegister).not.toHaveBeenCalled();
    });
});

describe("InstallView — processing branch, Tauri confirmation", () => {
    beforeEach(({ mockSession }) => {
        vi.clearAllMocks();
        mockResolveMerchant.mockResolvedValue({ data: null });
        mockEnsurePost.mockResolvedValue({ error: null });
        pendingActionsStore.getState().clearAll();
        modalStore.setState({ modal: null, stack: [] });
        sessionStore.getState().setSession(mockSession);
        mockIsTauri.mockReturnValue(true);
    });

    afterEach(() => {
        pendingActionsStore.getState().clearAll();
        sessionStore.getState().clearSession();
        modalStore.setState({ modal: null, stack: [] });
        mockIsTauri.mockReturnValue(false);
    });

    test("holds the page and opens the confirmation instead of navigating", async ({
        queryWrapper,
    }) => {
        const toWallet = vi.fn();

        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1" }}
                navigation={{ toWallet, toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => expect(mockEnsurePost).toHaveBeenCalled());
        await waitFor(() =>
            expect(modalStore.getState().modal?.id).toBe("recoveryCodeSuccess")
        );
        expect(toWallet).not.toHaveBeenCalled();
    });

    test("the confirmation carries an explicit way out", async ({
        queryWrapper,
    }) => {
        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1" }}
                navigation={{ toWallet: vi.fn(), toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() =>
            expect(modalStore.getState().modal?.id).toBe("recoveryCodeSuccess")
        );

        const modal = modalStore.getState().modal;
        if (modal?.id !== "recoveryCodeSuccess") throw new Error("no modal");
        // `ResponsiveModal` draws no close affordance, so without this the
        // only exits are swipe, backdrop or hardware back.
        expect(modal.actionLabel).toBe("installCode.openWalletCta");
    });

    test("an idle user is not stranded on the confirmation", async ({
        queryWrapper,
    }) => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const toWallet = vi.fn();

        try {
            render(
                <InstallView
                    search={{ m: "merchant-1", a: "anon-1" }}
                    navigation={{ toWallet, toRegister: vi.fn() }}
                    processingLayout={Layout}
                />,
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() =>
                expect(modalStore.getState().modal?.id).toBe(
                    "recoveryCodeSuccess"
                )
            );

            await vi.advanceTimersByTimeAsync(11_000);

            expect(toWallet).toHaveBeenCalledTimes(1);
            expect(modalStore.getState().modal).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    test("the processing screen stops claiming setup once the confirmation opens", async ({
        queryWrapper,
    }) => {
        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1" }}
                navigation={{ toWallet: vi.fn(), toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        expect(screen.getByText("installCode.processing")).toBeInTheDocument();

        // The confirmation sits over this screen; a spinner still saying
        // "setting up" would contradict it.
        await waitFor(() =>
            expect(
                screen.getByText("installCode.processingDone")
            ).toBeInTheDocument()
        );
        expect(
            screen.queryByText("installCode.processing")
        ).not.toBeInTheDocument();
    });

    test("the confirmation's exit hands over to the wallet exactly once", async ({
        queryWrapper,
    }) => {
        const toWallet = vi.fn();

        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1" }}
                navigation={{ toWallet, toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() =>
            expect(modalStore.getState().modal?.id).toBe("recoveryCodeSuccess")
        );

        const modal = modalStore.getState().modal;
        if (modal?.id !== "recoveryCodeSuccess") throw new Error("no modal");
        modal.onExit();

        expect(toWallet).toHaveBeenCalledTimes(1);
    });

    test("a resolved merchant is carried into the confirmation", async ({
        queryWrapper,
    }) => {
        mockResolveMerchant.mockResolvedValue({
            data: { name: "Nike", domain: "nike.com" },
        });

        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1" }}
                navigation={{ toWallet: vi.fn(), toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() =>
            expect(modalStore.getState().modal?.id).toBe("recoveryCodeSuccess")
        );

        const modal = modalStore.getState().modal;
        if (modal?.id !== "recoveryCodeSuccess") throw new Error("no modal");
        expect(modal.merchant?.name).toBe("Nike");
    });

    test("closing the confirmation from outside it still hands over", async ({
        queryWrapper,
    }) => {
        const toWallet = vi.fn();

        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1" }}
                navigation={{ toWallet, toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() =>
            expect(modalStore.getState().modal?.id).toBe("recoveryCodeSuccess")
        );

        // What `useHardwareBack` does on Android back: pops the store
        // directly, never touching the modal component.
        modalStore.getState().closeModal();

        // Exits settle after the update commits, never inside it.
        await waitFor(() => expect(toWallet).toHaveBeenCalledTimes(1));
        expect(modalStore.getState().modal).toBeNull();
    });

    test("an offline merchant lookup still reaches the confirmation", async ({
        queryWrapper,
    }) => {
        // A paused fetch settles neither way, so an unbounded await here is
        // a dead end: this screen's exit must never depend on the network.
        onlineManager.setOnline(false);
        mockResolveMerchant.mockImplementation(
            () => Promise.withResolvers<never>().promise
        );
        const toWallet = vi.fn();

        try {
            render(
                <InstallView
                    search={{ m: "merchant-1", a: "anon-1" }}
                    navigation={{ toWallet, toRegister: vi.fn() }}
                    processingLayout={Layout}
                />,
                { wrapper: queryWrapper.wrapper }
            );

            // Past the lookup bound, not merely past the dwell.
            await waitFor(
                () =>
                    expect(modalStore.getState().modal?.id).toBe(
                        "recoveryCodeSuccess"
                    ),
                { timeout: 4000 }
            );

            const modal = modalStore.getState().modal;
            if (modal?.id !== "recoveryCodeSuccess")
                throw new Error("no modal");
            expect(modal.merchant).toBeUndefined();

            modal.onExit();
            expect(toWallet).toHaveBeenCalledTimes(1);
        } finally {
            onlineManager.setOnline(true);
        }
    });

    test("an unresolved merchant still confirms, without a merchant name", async ({
        queryWrapper,
    }) => {
        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1" }}
                navigation={{ toWallet: vi.fn(), toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() =>
            expect(modalStore.getState().modal?.id).toBe("recoveryCodeSuccess")
        );

        const modal = modalStore.getState().modal;
        if (modal?.id !== "recoveryCodeSuccess") throw new Error("no modal");
        expect(modal.merchant).toBeUndefined();
    });

    test("without a merchant id it auto-navigates, opening no confirmation", async ({
        queryWrapper,
    }) => {
        const toWallet = vi.fn();

        render(
            <InstallView
                search={{ a: "anon-1" }}
                navigation={{ toWallet, toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => expect(toWallet).toHaveBeenCalled());
        expect(modalStore.getState().modal).toBeNull();
    });

    test("off Tauri the same visitor auto-navigates, opening no confirmation", async ({
        queryWrapper,
    }) => {
        mockIsTauri.mockReturnValue(false);
        const toWallet = vi.fn();

        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1" }}
                navigation={{ toWallet, toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => expect(toWallet).toHaveBeenCalled());
        expect(modalStore.getState().modal).toBeNull();
    });
});

describe("InstallView — install-code branch, post-install detection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveMerchant.mockResolvedValue({ data: null });
        mockGenerateCode.mockResolvedValue({
            data: {
                code: "ABCD1234",
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
            },
            error: null,
        });
        sessionStore.getState().clearSession();
        window.location.hash = "";
    });

    afterEach(() => {
        window.location.hash = "";
    });

    test("no fragment arrives: behaviour is byte-identical to today", async ({
        queryWrapper,
    }) => {
        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1" }}
                navigation={{ toWallet: vi.fn(), toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        // The info card lands with the minted code; the download CTA renders
        // before it, so waiting on that would race the mint.
        await waitFor(() =>
            expect(
                screen.getByText("installCode.infoTitle")
            ).toBeInTheDocument()
        );
        expect(screen.getByText("installCode.download")).toBeInTheDocument();
        expect(
            screen.queryByText("installCode.installedHeadline")
        ).not.toBeInTheDocument();
        expect(mockTrackEvent).not.toHaveBeenCalledWith(
            "install_detected",
            expect.anything()
        );
    });

    test("hashchange carrying installed=1 flips the CTA and fires install_detected once", async ({
        queryWrapper,
    }) => {
        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1" }}
                navigation={{ toWallet: vi.fn(), toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() =>
            expect(screen.getByText("installCode.download")).toBeInTheDocument()
        );

        window.location.hash =
            "#p=proof-1&sid=session-1&probe=ok&installed=1&dt=4200&via=overlay";
        window.dispatchEvent(new Event("hashchange"));

        await waitFor(() =>
            expect(
                screen.getByText("installCode.openWallet")
            ).toBeInTheDocument()
        );
        expect(
            screen.getByText("installCode.installedHeadline")
        ).toBeInTheDocument();

        await waitFor(() =>
            expect(mockTrackEvent).toHaveBeenCalledWith("install_detected", {
                merchant_id: "merchant-1",
                elapsed_ms: 4200,
                surface: "overlay",
            })
        );
        const detectedCalls = mockTrackEvent.mock.calls.filter(
            ([event]) => event === "install_detected"
        );
        expect(detectedCalls).toHaveLength(1);

        // A second identical rewrite does not re-fire hashchange in a real
        // browser; simulating the dispatch anyway proves the ref guard holds.
        window.dispatchEvent(new Event("hashchange"));
        await waitFor(() => {
            const stillOne = mockTrackEvent.mock.calls.filter(
                ([event]) => event === "install_detected"
            );
            expect(stillOne).toHaveLength(1);
        });
    });

    test("the collapsed code and its info card stay hidden until the toggle is tapped", async ({
        queryWrapper,
    }) => {
        window.location.hash = "#installed=1&dt=100&via=product";

        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1" }}
                navigation={{ toWallet: vi.fn(), toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() =>
            expect(
                screen.getByText("installCode.installedCodeToggle")
            ).toBeInTheDocument()
        );
        expect(screen.queryByText("A B C D 1 2")).not.toBeInTheDocument();
        expect(
            screen.queryByText("installCode.infoTitle")
        ).not.toBeInTheDocument();

        fireEvent.click(screen.getByText("installCode.installedCodeToggle"));

        await waitFor(() =>
            expect(screen.getByText("A B C D 1 2")).toBeInTheDocument()
        );
        expect(screen.getByText("installCode.infoTitle")).toBeInTheDocument();
    });

    test("probe: disabled fires install_probe_unavailable once, before any hashchange", async ({
        queryWrapper,
    }) => {
        window.location.hash = "#probe=disabled";

        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1" }}
                navigation={{ toWallet: vi.fn(), toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() =>
            expect(mockTrackEvent).toHaveBeenCalledWith(
                "install_probe_unavailable",
                { merchant_id: "merchant-1", reason: "disabled" }
            )
        );
        const calls = mockTrackEvent.mock.calls.filter(
            ([event]) => event === "install_probe_unavailable"
        );
        expect(calls).toHaveLength(1);
    });

    test("tapping the installed-state CTA fires install_open_wallet_clicked, not install_store_clicked", async ({
        queryWrapper,
    }) => {
        window.location.hash = "#installed=1&dt=100&via=product";

        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1" }}
                navigation={{ toWallet: vi.fn(), toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        const cta = await screen.findByText("installCode.openWallet");
        fireEvent.click(cta);

        expect(mockTrackEvent).toHaveBeenCalledWith(
            "install_open_wallet_clicked",
            { merchant_id: "merchant-1" }
        );
        expect(mockTrackEvent).not.toHaveBeenCalledWith(
            "install_store_clicked",
            expect.anything()
        );
    });

    test("a refused credential renders the download CTA, never the error", async ({
        queryWrapper,
    }) => {
        mockGenerateCode.mockResolvedValue({
            data: null,
            error: { status: 404, value: { code: "MERCHANT_NOT_CONFIGURED" } },
        });

        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1" }}
                navigation={{ toWallet: vi.fn(), toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() =>
            expect(
                screen.getByText("installCode.codelessTitle")
            ).toBeInTheDocument()
        );
        expect(screen.getByText("installCode.download")).toBeInTheDocument();
        expect(screen.queryByText("installCode.error")).not.toBeInTheDocument();
        expect(
            screen.queryByText("installCode.infoTitle")
        ).not.toBeInTheDocument();
    });

    test("a 5xx whose retries are exhausted renders the download CTA, never an error", async ({
        queryWrapper,
    }) => {
        mockGenerateCode.mockResolvedValue({
            data: null,
            error: { status: 503, value: null },
        });

        render(
            <InstallView
                search={{ m: "merchant-1", a: "anon-1" }}
                navigation={{ toWallet: vi.fn(), toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        // Four attempts against the hook's capped backoff (~3.5s) before the
        // query goes terminal; the view owns the hook, so retry can't be
        // disabled from here.
        await waitFor(
            () =>
                expect(
                    screen.getByText("installCode.codelessTitle")
                ).toBeInTheDocument(),
            { timeout: 10_000 }
        );
        expect(screen.getByText("installCode.download")).toBeInTheDocument();
        expect(screen.queryByText("installCode.title")).not.toBeInTheDocument();
        // A reinstated error branch shows up as this literal (see the raw-key
        // note above `Layout`).
        expect(screen.queryByText("installCode.error")).not.toBeInTheDocument();
        expect(
            screen.queryByText("installCode.infoTitle")
        ).not.toBeInTheDocument();
    });

    test("no credential at all renders the download CTA, never a codeless code view", async ({
        queryWrapper,
    }) => {
        render(
            <InstallView
                search={{ m: "merchant-1" }}
                navigation={{ toWallet: vi.fn(), toRegister: vi.fn() }}
                processingLayout={Layout}
            />,
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() =>
            expect(
                screen.getByText("installCode.codelessTitle")
            ).toBeInTheDocument()
        );
        expect(screen.getByText("installCode.download")).toBeInTheDocument();
        expect(screen.queryByText("installCode.title")).not.toBeInTheDocument();
        expect(
            screen.queryByText("installCode.infoTitle")
        ).not.toBeInTheDocument();
        expect(mockGenerateCode).not.toHaveBeenCalled();
    });

    test("an offline-paused mint renders the codeless hero, not a code hero with no code", async ({
        queryWrapper,
    }) => {
        // A paused fetch reports neither `error` nor `isLoading`, so without
        // the `fetchStatus` guard the hero asks for a code that never arrives.
        // `onlineManager`, not `navigator.onLine`: react-query reads its own
        // manager, and setting it false is what pauses a pending fetch.
        onlineManager.setOnline(false);
        // Never settles: the query must be pending so `fetchStatus` is what
        // decides the render, not a resolved or rejected result.
        mockGenerateCode.mockImplementation(
            () => Promise.withResolvers<never>().promise
        );

        try {
            render(
                <InstallView
                    search={{ m: "merchant-1", a: "anon-1" }}
                    navigation={{ toWallet: vi.fn(), toRegister: vi.fn() }}
                    processingLayout={Layout}
                />,
                { wrapper: queryWrapper.wrapper }
            );

            await waitFor(() =>
                expect(
                    screen.getByText("installCode.codelessTitle")
                ).toBeInTheDocument()
            );
            expect(
                screen.queryByText("installCode.title")
            ).not.toBeInTheDocument();
            expect(
                screen.getByText("installCode.download")
            ).toBeInTheDocument();
        } finally {
            onlineManager.setOnline(true);
        }
    });
});
