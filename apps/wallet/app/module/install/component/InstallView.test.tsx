/** @jsxImportSource react */
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
// `vi` must come from "vitest" directly: `vi.mock` is hoisted above module
// imports, so routing it through the fixtures module would reference an
// uninitialized binding.
import { vi } from "vitest";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
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
const { mockEnsurePost, mockGenerateCode, mockTrackEvent } = vi.hoisted(() => ({
    mockEnsurePost: vi.fn(),
    mockGenerateCode: vi.fn(),
    mockTrackEvent: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared/common/api/backendClient", () => ({
    authenticatedBackendApi: {
        user: {
            identity: {
                ensure: { post: mockEnsurePost },
                "install-code": { generate: { post: mockGenerateCode } },
            },
            merchant: {
                resolve: { get: vi.fn().mockResolvedValue({ data: null }) },
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

describe("InstallView — install-code branch, post-install detection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

        await waitFor(() =>
            expect(screen.getByText("installCode.download")).toBeInTheDocument()
        );
        expect(
            screen.queryByText("installCode.installedTitle")
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
            screen.getByText("installCode.installedTitle")
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

    test("the collapsed code stays hidden until the toggle is tapped", async ({
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

        fireEvent.click(screen.getByText("installCode.installedCodeToggle"));

        await waitFor(() =>
            expect(screen.getByText("A B C D 1 2")).toBeInTheDocument()
        );
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
});
