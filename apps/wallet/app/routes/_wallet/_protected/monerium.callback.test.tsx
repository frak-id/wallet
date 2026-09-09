/** @jsxImportSource react */

import type * as WalletShared from "@frak-labs/wallet-shared";
import type * as ReactRouter from "@tanstack/react-router";
import { render, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
// `vi` must come from "vitest" directly: `vi.mock` is hoisted above module
// imports, so routing it through the fixtures module would reference an
// uninitialized binding.
import { vi } from "vitest";
import {
    moneriumStore,
    PENDING_AUTH_TTL_MS,
} from "@/module/monerium/store/moneriumStore";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

type Search = { code?: string; state?: string; error?: string };

const { mockSearch, mockExchange, mockTrackEvent } = vi.hoisted(() => ({
    mockSearch: { current: {} as Search },
    mockExchange: vi.fn(),
    mockTrackEvent: vi.fn(),
}));

// `Route.useSearch()` reads the router context, which no bare `render` has.
// Mocking the factory keeps `Route.options.component` reachable without
// standing up a `RouterProvider`.
vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof ReactRouter>();
    return {
        ...actual,
        useNavigate: () => vi.fn(),
        createFileRoute: () => (options: Record<string, unknown>) => ({
            options,
            useSearch: () => mockSearch.current,
        }),
    };
});

vi.mock("@/module/monerium/utils/moneriumApi", () => ({
    exchangeCodeForTokens: mockExchange,
}));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual = await importOriginal<typeof WalletShared>();
    return { ...actual, trackEvent: mockTrackEvent, recordError: vi.fn() };
});

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

import { Route } from "./monerium.callback";

const MoneriumCallback = Route.options.component as () => ReactElement;

const VERIFIER = "verifier-abc";
const STATE = "state-xyz";

function outcomes(): string[] {
    return mockTrackEvent.mock.calls
        .filter(([name]) => name === "monerium_callback_outcome")
        .map(([, payload]) => (payload as { outcome: string }).outcome);
}

describe("MoneriumCallback — pending auth guard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        moneriumStore.getState().disconnect();
        mockSearch.current = {};
        mockExchange.mockResolvedValue({
            access_token: "access-token",
            refresh_token: "refresh-token",
            expires_in: 3600,
        });
    });

    test("exchanges the code when the pending pair is fresh", async ({
        queryWrapper,
    }) => {
        moneriumStore.getState().setPendingAuth(VERIFIER, STATE);
        mockSearch.current = { code: "auth-code", state: STATE };

        render(<MoneriumCallback />, { wrapper: queryWrapper.wrapper });

        await waitFor(() =>
            expect(mockExchange).toHaveBeenCalledWith("auth-code", VERIFIER)
        );
        await waitFor(() => expect(outcomes()).toContain("exchanged"));
        expect(moneriumStore.getState().accessToken).toBe("access-token");
    });

    test("refuses to exchange a pair older than the TTL", async ({
        queryWrapper,
    }) => {
        moneriumStore.getState().setPendingAuth(VERIFIER, STATE);
        moneriumStore.setState({
            pendingAuthCreatedAt: Date.now() - (PENDING_AUTH_TTL_MS + 1000),
        });
        mockSearch.current = { code: "auth-code", state: STATE };

        render(<MoneriumCallback />, { wrapper: queryWrapper.wrapper });

        await waitFor(() => expect(outcomes()).toContain("session_expired"));
        expect(mockExchange).not.toHaveBeenCalled();
    });

    test("refuses to exchange a pair stamped in the future", async ({
        queryWrapper,
    }) => {
        moneriumStore.getState().setPendingAuth(VERIFIER, STATE);
        moneriumStore.setState({
            pendingAuthCreatedAt: Date.now() + 10 * PENDING_AUTH_TTL_MS,
        });
        mockSearch.current = { code: "auth-code", state: STATE };

        render(<MoneriumCallback />, { wrapper: queryWrapper.wrapper });

        await waitFor(() => expect(outcomes()).toContain("session_expired"));
        expect(mockExchange).not.toHaveBeenCalled();
    });

    test("reports session_expired when no pending pair is stored", async ({
        queryWrapper,
    }) => {
        mockSearch.current = { code: "auth-code", state: STATE };

        render(<MoneriumCallback />, { wrapper: queryWrapper.wrapper });

        await waitFor(() => expect(outcomes()).toContain("session_expired"));
        expect(mockExchange).not.toHaveBeenCalled();
    });

    test("a state mismatch keeps the pending pair for a later callback", async ({
        queryWrapper,
    }) => {
        moneriumStore.getState().setPendingAuth(VERIFIER, STATE);
        mockSearch.current = { code: "auth-code", state: "not-ours" };

        render(<MoneriumCallback />, { wrapper: queryWrapper.wrapper });

        await waitFor(() => expect(outcomes()).toContain("csrf_mismatch"));
        expect(mockExchange).not.toHaveBeenCalled();
        expect(moneriumStore.getState().pendingCodeVerifier).toBe(VERIFIER);
    });

    test("an expired pair is refused before the CSRF check", async ({
        queryWrapper,
    }) => {
        moneriumStore.getState().setPendingAuth(VERIFIER, STATE);
        moneriumStore.setState({
            pendingAuthCreatedAt: Date.now() - (PENDING_AUTH_TTL_MS + 1000),
        });
        mockSearch.current = { code: "auth-code", state: "not-ours" };

        render(<MoneriumCallback />, { wrapper: queryWrapper.wrapper });

        await waitFor(() => expect(outcomes()).toContain("session_expired"));
        expect(outcomes()).not.toContain("csrf_mismatch");
    });

    test("clears the pending pair once the exchange succeeds", async ({
        queryWrapper,
    }) => {
        moneriumStore.getState().setPendingAuth(VERIFIER, STATE);
        mockSearch.current = { code: "auth-code", state: STATE };

        render(<MoneriumCallback />, { wrapper: queryWrapper.wrapper });

        await waitFor(() =>
            expect(moneriumStore.getState().pendingCodeVerifier).toBeNull()
        );
        expect(moneriumStore.getState().pendingAuthCreatedAt).toBeNull();
    });

    test("records cancelled when the provider returns an error and no code", async ({
        queryWrapper,
    }) => {
        mockSearch.current = { error: "access_denied" };

        render(<MoneriumCallback />, { wrapper: queryWrapper.wrapper });

        await waitFor(() => expect(outcomes()).toContain("cancelled"));
        expect(mockExchange).not.toHaveBeenCalled();
    });
});
