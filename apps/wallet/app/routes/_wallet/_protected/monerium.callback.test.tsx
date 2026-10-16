/** @jsxImportSource react */

import type * as WalletShared from "@frak-labs/wallet-shared";
import type * as ReactRouter from "@tanstack/react-router";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { type ReactElement, type ReactNode, StrictMode } from "react";
// `vi` comes from "vitest": a hoisted `vi.mock` cannot reach a fixtures re-export.
import { vi } from "vitest";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import { fail, moneriumStatus, ok } from "@/tests/moneriumFixtures";
import {
    beforeEach,
    describe,
    expect,
    test,
    type WalletTestFixtures,
} from "@/tests/vitest-fixtures";

type Search = { code?: string; state?: string; error?: string };

const {
    mockSearch,
    mockCallback,
    mockTrackEvent,
    mockRecordError,
    mockNavigate,
    mockEnabled,
} = vi.hoisted(() => ({
    mockSearch: { current: {} as Search },
    mockCallback: vi.fn(),
    mockTrackEvent: vi.fn(),
    mockRecordError: vi.fn(),
    mockNavigate: vi.fn(),
    mockEnabled: { current: true },
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

vi.mock("@/module/monerium/utils/moneriumConfig", () => ({
    get isMoneriumEnabled() {
        return mockEnabled.current;
    },
}));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual = await importOriginal<typeof WalletShared>();
    return {
        ...actual,
        trackEvent: mockTrackEvent,
        recordError: mockRecordError,
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
const beforeLoad = Route.options.beforeLoad as () => void;

const STATUS = moneriumStatus({
    environment: "sandbox",
    profile: null,
    walletLink: "none",
});

const OPEN_BANK_FLOW = {
    to: "/wallet",
    search: { open: "monerium" },
    replace: true,
};

function outcomes(): string[] {
    return mockTrackEvent.mock.calls
        .filter(([name]) => name === "monerium_callback_outcome")
        .map(([, payload]) => (payload as { outcome: string }).outcome);
}

function strictWrapper(queryWrapper: WalletTestFixtures["queryWrapper"]) {
    return ({ children }: { children: ReactNode }) => (
        <StrictMode>
            <queryWrapper.wrapper>{children}</queryWrapper.wrapper>
        </StrictMode>
    );
}

describe("MoneriumCallback", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSearch.current = {};
        mockEnabled.current = true;
        mockCallback.mockResolvedValue(ok(STATUS));
    });

    test("forwards code and state to the backend, caches the status, then opens the bank flow", async ({
        queryWrapper,
    }) => {
        mockSearch.current = { code: "auth-code", state: "st" };
        const setQueryData = vi.spyOn(queryWrapper.client, "setQueryData");

        render(<MoneriumCallback />, { wrapper: queryWrapper.wrapper });

        await waitFor(() =>
            expect(mockCallback).toHaveBeenCalledWith({
                code: "auth-code",
                state: "st",
            })
        );
        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith(OPEN_BANK_FLOW)
        );
        expect(outcomes()).toContain("exchanged");
        expect(setQueryData).toHaveBeenCalledWith(moneriumKey.status, STATUS);
    });

    test("exchanges the single-use code only once when the effect runs twice", async ({
        queryWrapper,
    }) => {
        mockSearch.current = { code: "auth-code", state: "st" };

        render(<MoneriumCallback />, { wrapper: strictWrapper(queryWrapper) });

        await waitFor(() => expect(outcomes()).toContain("exchanged"));
        expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    test("reports session_expired without an error report when the backend no longer knows the state", async ({
        queryWrapper,
    }) => {
        mockCallback.mockResolvedValue(
            fail(400, "MONERIUM_AUTH_STATE_INVALID")
        );
        mockSearch.current = { code: "auth-code", state: "st" };

        const { findByText } = render(<MoneriumCallback />, {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(outcomes()).toContain("session_expired"));
        expect(await findByText("monerium.callback.expiredTitle")).toBeTruthy();
        expect(mockRecordError).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    test("reports error on any other backend failure", async ({
        queryWrapper,
    }) => {
        mockCallback.mockResolvedValue(fail(502));
        mockSearch.current = { code: "auth-code", state: "st" };

        const { findByText } = render(<MoneriumCallback />, {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(outcomes()).toContain("error"));
        expect(await findByText("monerium.callback.errorTitle")).toBeTruthy();
        expect(mockRecordError).toHaveBeenCalledOnce();
    });

    test("records cancelled when the provider returns an error and no code", async ({
        queryWrapper,
    }) => {
        mockSearch.current = { error: "access_denied" };

        const { findByText } = render(<MoneriumCallback />, {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(outcomes()).toEqual(["cancelled"]));
        expect(
            await findByText("monerium.callback.cancelledTitle")
        ).toBeTruthy();
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

        expect(mockNavigate).toHaveBeenCalledWith(OPEN_BANK_FLOW);
    });
});

describe("monerium callback route guard", () => {
    function thrownBy(run: () => void): unknown {
        try {
            run();
        } catch (error) {
            return error;
        }
        return undefined;
    }

    test("redirects to the wallet while Monerium is disabled", () => {
        mockEnabled.current = false;

        expect(thrownBy(beforeLoad)).toMatchObject({
            options: { to: "/wallet", replace: true },
        });
    });

    test("lets the callback through when Monerium is enabled", () => {
        mockEnabled.current = true;

        expect(thrownBy(beforeLoad)).toBeUndefined();
    });
});
