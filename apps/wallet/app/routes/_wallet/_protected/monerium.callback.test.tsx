/** @jsxImportSource react */

import type * as WalletShared from "@frak-labs/wallet-shared";
import type * as ReactRouter from "@tanstack/react-router";
import { fireEvent, render, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
// `vi` must come from "vitest" directly: `vi.mock` is hoisted above module
// imports, so routing it through the fixtures module would reference an
// uninitialized binding.
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

type Search = { code?: string; state?: string; error?: string };

const {
    mockSearch,
    mockCallback,
    mockTrackEvent,
    mockNavigate,
    mockOpenModal,
} = vi.hoisted(() => ({
    mockSearch: { current: {} as Search },
    mockCallback: vi.fn(),
    mockTrackEvent: vi.fn(),
    mockNavigate: vi.fn(),
    mockOpenModal: vi.fn(),
}));

// `Route.useSearch()` reads the router context, which no bare `render` has.
vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof ReactRouter>();
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        createFileRoute: () => (options: Record<string, unknown>) => ({
            options,
            useSearch: () => mockSearch.current,
        }),
    };
});

vi.mock("@/module/stores/modalStore", () => ({
    modalStore: { getState: () => ({ openModal: mockOpenModal }) },
}));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual = await importOriginal<typeof WalletShared>();
    return {
        ...actual,
        trackEvent: mockTrackEvent,
        recordError: vi.fn(),
        authenticatedWalletApi: {
            monerium: { auth: { callback: { post: mockCallback } } },
        },
    };
});

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

import { Route } from "./monerium.callback";

const MoneriumCallback = Route.options.component as () => ReactElement;

const STATUS = {
    connection: "connected",
    profile: null,
    walletLink: "none",
    silentReconnect: false,
    environment: "sandbox",
};

function outcomes(): string[] {
    return mockTrackEvent.mock.calls
        .filter(([name]) => name === "monerium_callback_outcome")
        .map(([, payload]) => (payload as { outcome: string }).outcome);
}

describe("MoneriumCallback", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSearch.current = {};
        mockCallback.mockResolvedValue({ data: STATUS, error: null });
    });

    test("forwards code and state to the backend, then opens the bank flow", async ({
        queryWrapper,
    }) => {
        mockSearch.current = { code: "auth-code", state: "st" };

        render(<MoneriumCallback />, { wrapper: queryWrapper.wrapper });

        await waitFor(() =>
            expect(mockCallback).toHaveBeenCalledWith({
                code: "auth-code",
                state: "st",
            })
        );
        await waitFor(() => expect(outcomes()).toContain("exchanged"));
        expect(mockOpenModal).toHaveBeenCalledWith({ id: "moneriumBankFlow" });
        expect(mockNavigate).toHaveBeenCalledWith({
            to: "/wallet",
            replace: true,
        });
    });

    test("reports session_expired when the backend no longer knows the state", async ({
        queryWrapper,
    }) => {
        mockCallback.mockResolvedValue({
            data: null,
            error: {
                status: 400,
                value: { code: "MONERIUM_AUTH_STATE_INVALID" },
            },
        });
        mockSearch.current = { code: "auth-code", state: "st" };

        const { findByText } = render(<MoneriumCallback />, {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(outcomes()).toContain("session_expired"));
        expect(await findByText("monerium.callback.expiredTitle")).toBeTruthy();
        expect(mockOpenModal).not.toHaveBeenCalled();
    });

    test("reports error on any other backend failure", async ({
        queryWrapper,
    }) => {
        mockCallback.mockResolvedValue({
            data: null,
            error: { status: 502, value: {} },
        });
        mockSearch.current = { code: "auth-code", state: "st" };

        render(<MoneriumCallback />, { wrapper: queryWrapper.wrapper });

        await waitFor(() => expect(outcomes()).toContain("error"));
    });

    test("records cancelled when the provider returns an error and no code", async ({
        queryWrapper,
    }) => {
        mockSearch.current = { error: "access_denied" };

        render(<MoneriumCallback />, { wrapper: queryWrapper.wrapper });

        await waitFor(() => expect(outcomes()).toEqual(["cancelled"]));
        expect(mockCallback).not.toHaveBeenCalled();
    });

    test("records no_code when hit without any OAuth context", async ({
        queryWrapper,
    }) => {
        render(<MoneriumCallback />, { wrapper: queryWrapper.wrapper });

        await waitFor(() => expect(outcomes()).toEqual(["no_code"]));
    });

    test("Try again reopens the bank flow on the wallet instead of the profile", async ({
        queryWrapper,
    }) => {
        mockSearch.current = { error: "access_denied" };

        const { findByText } = render(<MoneriumCallback />, {
            wrapper: queryWrapper.wrapper,
        });
        fireEvent.click(await findByText("monerium.callback.tryAgain"));

        expect(mockOpenModal).toHaveBeenCalledWith({ id: "moneriumBankFlow" });
        expect(mockNavigate).toHaveBeenCalledWith({
            to: "/wallet",
            replace: true,
        });
    });
});
