/** @jsxImportSource react */
import type * as WalletShared from "@frak-labs/wallet-shared";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({
    prepare: vi.fn(),
    siwe: vi.fn(),
    start: vi.fn(),
    sign: vi.fn(),
    track: vi.fn(),
    openExternal: vi.fn(),
    isTauri: { value: false },
}));

vi.mock("@frak-labs/app-essentials/utils/platform", async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import("@frak-labs/app-essentials/utils/platform")
        >();
    return {
        ...actual,
        get IS_TAURI() {
            return mocks.isTauri.value;
        },
    };
});
vi.mock("wagmi", () => ({
    useSignMessage: () => ({ mutateAsync: mocks.sign }),
}));
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual = await importOriginal<typeof WalletShared>();
    return {
        ...actual,
        trackEvent: mocks.track,
        recordError: vi.fn(),
        openExternalUrl: mocks.openExternal,
        authenticatedWalletApi: {
            monerium: {
                auth: {
                    siwe: {
                        post: mocks.siwe,
                        prepare: { post: mocks.prepare },
                    },
                    start: { post: mocks.start },
                },
            },
        },
    };
});

import { useMoneriumConnect } from "./useMoneriumConnect";

const STATUS = {
    connection: "connected",
    profile: { id: "p", kind: "personal", state: "approved" },
    walletLink: "linked",
    silentReconnect: true,
    environment: "sandbox",
};

function events(name: string) {
    return mocks.track.mock.calls.filter(([n]) => n === name).map(([, p]) => p);
}

describe("useMoneriumConnect", () => {
    const assign = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isTauri.value = false;
        Object.defineProperty(window, "location", {
            value: { ...window.location, assign },
            configurable: true,
        });
        mocks.start.mockResolvedValue({
            data: { url: "https://monerium.test/auth" },
            error: null,
        });
    });

    function setup(
        queryWrapper: {
            client: import("@tanstack/react-query").QueryClient;
            wrapper: React.ComponentType<{ children: React.ReactNode }>;
        },
        silentReconnect: boolean
    ) {
        queryWrapper.client.setQueryData(moneriumKey.status, {
            ...STATUS,
            silentReconnect,
        });
        return renderHook(() => useMoneriumConnect(), {
            wrapper: queryWrapper.wrapper,
        });
    }

    test("SIWE success signs the prepared message and skips the portal", async ({
        queryWrapper,
    }) => {
        mocks.prepare.mockResolvedValue({
            data: { state: "st", message: "msg" },
            error: null,
        });
        mocks.sign.mockResolvedValue("0xsig");
        mocks.siwe.mockResolvedValue({ data: STATUS, error: null });

        const { result } = setup(queryWrapper, true);
        await result.current.connectAsync({});

        expect(mocks.sign).toHaveBeenCalledWith({ message: "msg" });
        expect(mocks.siwe).toHaveBeenCalledWith({
            state: "st",
            signature: "0xsig",
        });
        expect(mocks.start).not.toHaveBeenCalled();
        expect(events("monerium_siwe_outcome")).toEqual([
            { outcome: "success" },
        ]);
    });

    test("SIWE rejected by the backend falls back to the portal", async ({
        queryWrapper,
    }) => {
        mocks.prepare.mockResolvedValue({
            data: { state: "st", message: "msg" },
            error: null,
        });
        mocks.sign.mockResolvedValue("0xsig");
        mocks.siwe.mockResolvedValue({
            data: null,
            error: { status: 422, value: { code: "MONERIUM_SIWE_REJECTED" } },
        });

        const { result } = setup(queryWrapper, true);
        await result.current.connectAsync({ authMode: "login" });

        expect(mocks.start).toHaveBeenCalledWith({ authMode: "login" });
        expect(assign).toHaveBeenCalledWith("https://monerium.test/auth");
        expect(events("monerium_siwe_fallback")).toEqual([
            { reason: "rejected" },
        ]);
    });

    test("a cancelled signature stops without opening the portal", async ({
        queryWrapper,
    }) => {
        mocks.prepare.mockResolvedValue({
            data: { state: "st", message: "msg" },
            error: null,
        });
        mocks.sign.mockRejectedValue(
            Object.assign(new Error("dismissed"), { name: "NotAllowedError" })
        );

        const { result } = setup(queryWrapper, true);
        await expect(result.current.connectAsync({})).rejects.toMatchObject({
            name: "NotAllowedError",
        });

        expect(mocks.siwe).not.toHaveBeenCalled();
        expect(mocks.start).not.toHaveBeenCalled();
        expect(assign).not.toHaveBeenCalled();
        expect(events("monerium_siwe_outcome")).toEqual([
            { outcome: "cancelled" },
        ]);
        expect(events("monerium_siwe_fallback")).toEqual([]);
    });

    test("without silentReconnect the portal is used directly", async ({
        queryWrapper,
    }) => {
        const { result } = setup(queryWrapper, false);
        await result.current.connectAsync({});

        expect(mocks.prepare).not.toHaveBeenCalled();
        expect(assign).toHaveBeenCalledWith("https://monerium.test/auth");
        expect(events("monerium_auth_started")).toEqual([
            { is_tauri: false, method: "portal" },
        ]);
    });

    test("opens the portal externally on Tauri", async ({ queryWrapper }) => {
        mocks.isTauri.value = true;
        const { result } = setup(queryWrapper, false);
        await result.current.connectAsync({});

        await waitFor(() =>
            expect(mocks.openExternal).toHaveBeenCalledWith(
                "https://monerium.test/auth"
            )
        );
        expect(assign).not.toHaveBeenCalled();
    });
});
