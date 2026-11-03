/** @jsxImportSource react */
import type * as WalletShared from "@frak-labs/wallet-shared";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import { fail, moneriumStatus, ok } from "@/tests/moneriumFixtures";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    type WalletTestFixtures,
} from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({
    prepare: vi.fn(),
    siwe: vi.fn(),
    start: vi.fn(),
    sign: vi.fn(),
    track: vi.fn(),
    openExternal: vi.fn(),
    recordError: vi.fn(),
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
        recordError: mocks.recordError,
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

const RECONNECTABLE = moneriumStatus({
    environment: "sandbox",
    silentReconnect: true,
});
const PREPARED = ok({ state: "st", message: "msg" });
const PORTAL_URL = "https://monerium.test/auth";
const originalLocation = window.location;

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
        mocks.start.mockResolvedValue(ok({ url: PORTAL_URL }));
    });

    afterEach(() => {
        Object.defineProperty(window, "location", {
            value: originalLocation,
            configurable: true,
        });
    });

    function setup(
        queryWrapper: WalletTestFixtures["queryWrapper"],
        silentReconnect: boolean
    ) {
        queryWrapper.client.setQueryData(moneriumKey.status, {
            ...RECONNECTABLE,
            silentReconnect,
        });
        return renderHook(() => useMoneriumConnect(), {
            wrapper: queryWrapper.wrapper,
        });
    }

    test("SIWE success signs the prepared message, caches the status and skips the portal", async ({
        queryWrapper,
    }) => {
        const reconnected = moneriumStatus({ silentReconnect: false });
        mocks.prepare.mockResolvedValue(PREPARED);
        mocks.sign.mockResolvedValue("0xsig");
        mocks.siwe.mockResolvedValue(ok(reconnected));
        const setQueryData = vi.spyOn(queryWrapper.client, "setQueryData");

        const { result } = setup(queryWrapper, true);
        await result.current.connectAsync({});

        expect(mocks.sign).toHaveBeenCalledWith({ message: "msg" });
        expect(mocks.siwe).toHaveBeenCalledWith({
            state: "st",
            signature: "0xsig",
        });
        expect(mocks.start).not.toHaveBeenCalled();
        expect(setQueryData).toHaveBeenCalledWith(
            moneriumKey.status,
            reconnected
        );
        expect(events("monerium_siwe_outcome")).toEqual([
            { outcome: "success" },
        ]);
    });

    test("SIWE rejected by the backend falls back to the portal", async ({
        queryWrapper,
    }) => {
        mocks.prepare.mockResolvedValue(PREPARED);
        mocks.sign.mockResolvedValue("0xsig");
        mocks.siwe.mockResolvedValue(fail(422, "MONERIUM_SIWE_REJECTED"));

        const { result } = setup(queryWrapper, true);
        await result.current.connectAsync({ authMode: "login" });

        expect(mocks.start).toHaveBeenCalledWith({ authMode: "login" });
        expect(assign).toHaveBeenCalledWith(PORTAL_URL);
        expect(events("monerium_siwe_fallback")).toEqual([
            { reason: "rejected" },
        ]);
    });

    test("an unavailable SIWE falls back to the portal without an error report", async ({
        queryWrapper,
    }) => {
        mocks.prepare.mockResolvedValue(fail(409, "MONERIUM_SIWE_UNAVAILABLE"));
        const invalidate = vi.spyOn(queryWrapper.client, "invalidateQueries");

        const { result } = setup(queryWrapper, true);
        await result.current.connectAsync({});

        expect(assign).toHaveBeenCalledWith(PORTAL_URL);
        expect(events("monerium_siwe_fallback")).toEqual([
            { reason: "rejected" },
        ]);
        expect(mocks.recordError).not.toHaveBeenCalled();
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: moneriumKey.status,
        });
    });

    test("an unexpected SIWE failure falls back to the portal and is reported", async ({
        queryWrapper,
    }) => {
        mocks.prepare.mockResolvedValue(fail(500));

        const { result } = setup(queryWrapper, true);
        await result.current.connectAsync({});

        expect(assign).toHaveBeenCalledWith(PORTAL_URL);
        expect(events("monerium_siwe_fallback")).toEqual([{ reason: "error" }]);
        expect(mocks.recordError).toHaveBeenCalledOnce();
    });

    test("a cancelled signature stops without opening the portal", async ({
        queryWrapper,
    }) => {
        mocks.prepare.mockResolvedValue(PREPARED);
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
        expect(assign).toHaveBeenCalledWith(PORTAL_URL);
        expect(events("monerium_auth_started")).toEqual([
            { is_tauri: false, method: "portal" },
        ]);
    });

    test("opens the portal externally on Tauri", async ({ queryWrapper }) => {
        mocks.isTauri.value = true;
        const { result } = setup(queryWrapper, false);
        await result.current.connectAsync({});

        await waitFor(() =>
            expect(mocks.openExternal).toHaveBeenCalledWith(PORTAL_URL)
        );
        expect(assign).not.toHaveBeenCalled();
    });
});
