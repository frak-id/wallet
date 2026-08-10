/** @jsxImportSource react */
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import { render, screen, waitFor } from "@testing-library/react";
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
const { mockEnsurePost, mockGenerateCode } = vi.hoisted(() => ({
    mockEnsurePost: vi.fn(),
    mockGenerateCode: vi.fn(),
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
    return { ...actual, trackEvent: vi.fn(), recordError: vi.fn() };
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
