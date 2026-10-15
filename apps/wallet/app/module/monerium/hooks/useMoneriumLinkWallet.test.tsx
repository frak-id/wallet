/** @jsxImportSource react */
import type * as WalletShared from "@frak-labs/wallet-shared";
import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import { moneriumFlowStore } from "@/module/monerium/store/moneriumFlowStore";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

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

import { useMoneriumLinkWallet } from "./useMoneriumLinkWallet";

describe("useMoneriumLinkWallet", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.sign.mockResolvedValue("0xsig");
    });

    test.for([
        "MONERIUM_REAUTH_REQUIRED",
        "MONERIUM_NOT_CONNECTED",
        "MONERIUM_PROFILE_NOT_APPROVED",
    ])(
        "%s refetches the status so the derived screen moves on",
        async (code, { queryWrapper }) => {
            mocks.post.mockResolvedValue({
                data: null,
                error: { status: 409, value: { code } },
            });
            const invalidate = vi.spyOn(
                queryWrapper.client,
                "invalidateQueries"
            );
            const { result } = renderHook(() => useMoneriumLinkWallet(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.linkWalletAsync()
            ).rejects.toMatchObject({
                code,
            });

            expect(invalidate).toHaveBeenCalledWith({
                queryKey: moneriumKey.status,
            });
            expect(moneriumFlowStore.getState().screen).toBe("transfer-amount");
        }
    );

    test("a rejected link keeps the cached status", async ({
        queryWrapper,
    }) => {
        mocks.post.mockResolvedValue({
            data: null,
            error: { status: 422, value: { code: "MONERIUM_LINK_REJECTED" } },
        });
        const invalidate = vi.spyOn(queryWrapper.client, "invalidateQueries");
        const { result } = renderHook(() => useMoneriumLinkWallet(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(result.current.linkWalletAsync()).rejects.toThrow();
        expect(invalidate).not.toHaveBeenCalled();
    });
});
