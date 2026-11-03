/** @jsxImportSource react */
import type * as WalletShared from "@frak-labs/wallet-shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import { ibanStore } from "@/module/monerium/store/ibanStore";
import { moneriumStore } from "@/module/monerium/store/moneriumStore";
import { ok } from "@/tests/moneriumFixtures";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({ remove: vi.fn() }));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual = await importOriginal<typeof WalletShared>();
    return {
        ...actual,
        authenticatedWalletApi: {
            monerium: { connection: { delete: mocks.remove } },
        },
    };
});

import { useMoneriumDisconnect } from "./useMoneriumDisconnect";

const WALLET = "0x1111111111111111111111111111111111111111";
const IBAN = {
    iban: "DE89370400440532013000",
    firstName: "",
    lastName: "",
    pseudo: "Mine",
    own: true,
};

describe("useMoneriumDisconnect", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ibanStore.getState().reset();
        mocks.remove.mockResolvedValue(ok({ success: true }));
    });

    test("forgets the sync marker and the Monerium cache, keeps the saved IBANs", async ({
        queryWrapper,
    }) => {
        ibanStore.getState().mergeRemoteIbans([IBAN], WALLET);
        moneriumStore.getState().markSetupSuccessSeen();
        const resetQueries = vi.spyOn(queryWrapper.client, "resetQueries");
        const { result } = renderHook(() => useMoneriumDisconnect(), {
            wrapper: queryWrapper.wrapper,
        });

        act(() => result.current.disconnect());

        await waitFor(() =>
            expect(ibanStore.getState().syncedWallet).toBeNull()
        );
        expect(ibanStore.getState().knownIbans).toEqual([IBAN]);
        expect(moneriumStore.getState().hasSeenSetupSuccess).toBe(false);
        expect(resetQueries).toHaveBeenCalledWith({
            queryKey: moneriumKey.all,
        });
    });
});
