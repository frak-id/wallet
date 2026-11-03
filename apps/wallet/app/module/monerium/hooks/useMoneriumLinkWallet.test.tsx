/** @jsxImportSource react */
import type * as WalletShared from "@frak-labs/wallet-shared";
import { renderHook } from "@testing-library/react";
import { isSmartAccountDeployed } from "permissionless";
import { serializeErc6492Signature } from "viem";
import { vi } from "vitest";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import { fail, ok } from "@/tests/moneriumFixtures";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    sign: vi.fn(),
    send: vi.fn(),
}));

vi.mock("wagmi", () => ({
    useConnection: () => ({ address: "0x1111" }),
    useClient: () => ({}),
    useSignMessage: () => ({ mutateAsync: mocks.sign }),
    useSendTransaction: () => ({ mutateAsync: mocks.send }),
}));
vi.mock("permissionless", () => ({
    isSmartAccountDeployed: vi.fn().mockResolvedValue(true),
}));
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual = await importOriginal<typeof WalletShared>();
    return {
        ...actual,
        authenticatedWalletApi: {
            monerium: { wallet: { link: { post: mocks.post } } },
        },
    };
});

import {
    DEPLOYMENT_POLL_MS,
    useMoneriumLinkWallet,
} from "./useMoneriumLinkWallet";

const INNER_SIGNATURE = `0x${"ab".repeat(65)}` as const;

describe("useMoneriumLinkWallet", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.sign.mockResolvedValue(INNER_SIGNATURE);
        mocks.send.mockResolvedValue("0xtx");
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.mocked(isSmartAccountDeployed).mockResolvedValue(true);
    });

    test("sends Monerium the inner signature of an ERC-6492 wrapper", async ({
        queryWrapper,
    }) => {
        mocks.sign.mockResolvedValue(
            serializeErc6492Signature({
                address: "0x0000000000000000000000000000000000000f00",
                data: "0x1234",
                signature: INNER_SIGNATURE,
            })
        );
        mocks.post.mockResolvedValue(ok({ walletLink: "linked" }));
        const { result } = renderHook(() => useMoneriumLinkWallet(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.linkWalletAsync();

        expect(mocks.post).toHaveBeenCalledWith({
            signature: INNER_SIGNATURE,
        });
    });

    test("signs only once the fresh deployment is visible", async ({
        queryWrapper,
    }) => {
        vi.useFakeTimers();
        vi.mocked(isSmartAccountDeployed)
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);
        mocks.post.mockResolvedValue(ok({ walletLink: "linked" }));
        const { result } = renderHook(() => useMoneriumLinkWallet(), {
            wrapper: queryWrapper.wrapper,
        });

        const linking = result.current.linkWalletAsync();
        await vi.advanceTimersByTimeAsync(0);
        expect(mocks.send).toHaveBeenCalledOnce();
        expect(mocks.sign).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(DEPLOYMENT_POLL_MS);
        await linking;

        expect(mocks.sign).toHaveBeenCalledOnce();
    });

    test("gives up without linking when the deployment never shows", async ({
        queryWrapper,
    }) => {
        vi.useFakeTimers();
        vi.mocked(isSmartAccountDeployed).mockResolvedValue(false);
        const { result } = renderHook(() => useMoneriumLinkWallet(), {
            wrapper: queryWrapper.wrapper,
        });

        const linking = result.current.linkWalletAsync();
        const outcome = expect(linking).rejects.toMatchObject({ code: null });
        await vi.advanceTimersByTimeAsync(DEPLOYMENT_POLL_MS * 20);
        await outcome;

        expect(mocks.sign).not.toHaveBeenCalled();
        expect(mocks.post).not.toHaveBeenCalled();
    });

    test("a failed link refetches the status", async ({ queryWrapper }) => {
        mocks.post.mockResolvedValue(fail(422, "MONERIUM_LINK_REJECTED"));
        const invalidate = vi.spyOn(queryWrapper.client, "invalidateQueries");
        const { result } = renderHook(() => useMoneriumLinkWallet(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(result.current.linkWalletAsync()).rejects.toMatchObject({
            code: "MONERIUM_LINK_REJECTED",
        });
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: moneriumKey.status,
        });
    });
});
