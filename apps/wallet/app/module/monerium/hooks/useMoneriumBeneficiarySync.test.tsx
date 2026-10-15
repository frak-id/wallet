/** @jsxImportSource react */
import type * as WalletShared from "@frak-labs/wallet-shared";
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { ibanStore } from "@/module/monerium/store/ibanStore";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const WALLET = "0x1111111111111111111111111111111111111111";
const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("wagmi", () => ({ useConnection: () => ({ address: WALLET }) }));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) =>
            key.endsWith("ownAccountLabel") ? "My account" : key,
    }),
}));
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual = await importOriginal<typeof WalletShared>();
    return {
        ...actual,
        recordError: vi.fn(),
        authenticatedWalletApi: {
            monerium: { beneficiaries: { get: mocks.get } },
        },
    };
});

import {
    beneficiaryToIbanEntry,
    useMoneriumBeneficiarySync,
} from "./useMoneriumBeneficiarySync";

describe("beneficiaryToIbanEntry", () => {
    test("third-party gets a 'First Last' pseudo", () => {
        expect(
            beneficiaryToIbanEntry(
                {
                    iban: "de89 3704 0044 0532 0130 00",
                    own: false,
                    firstName: "Ada",
                    lastName: "Lovelace",
                    country: "DE",
                },
                "My account"
            )
        ).toEqual({
            iban: "DE89370400440532013000",
            firstName: "Ada",
            lastName: "Lovelace",
            pseudo: "Ada Lovelace",
            own: false,
            country: "DE",
        });
    });

    test("own gets the translated label and no names", () => {
        expect(
            beneficiaryToIbanEntry(
                { iban: "DE89370400440532013000", own: true, firstName: "X" },
                "My account"
            )
        ).toMatchObject({
            pseudo: "My account",
            firstName: "",
            own: true,
        });
    });
});

describe("useMoneriumBeneficiarySync", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ibanStore.getState().reset();
        mocks.get.mockResolvedValue({
            data: {
                beneficiaries: [
                    {
                        iban: "FR7630006000011234567890189",
                        own: false,
                        firstName: "Remote",
                        lastName: "Name",
                        country: "FR",
                        lastUsedAt: "2026-01-01T00:00:00Z",
                    },
                    {
                        iban: "DE89370400440532013000",
                        own: true,
                        lastUsedAt: "2026-01-01T00:00:00Z",
                    },
                ],
            },
            error: null,
        });
    });

    test("merges once, local entries win, then sets the marker", async ({
        queryWrapper,
    }) => {
        ibanStore.getState().addIban({
            iban: "FR7630006000011234567890189",
            firstName: "Local",
            lastName: "Entry",
            pseudo: "Local",
            own: false,
            country: "FR",
        });

        const { rerender } = renderHook(
            () => useMoneriumBeneficiarySync(true),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() =>
            expect(ibanStore.getState().syncedWallet).toBe(WALLET)
        );
        const entries = ibanStore.getState().knownIbans;
        expect(entries.map((e) => e.pseudo)).toEqual(["Local", "My account"]);

        rerender();
        expect(mocks.get).toHaveBeenCalledTimes(1);
    });

    test("does nothing when already synced for this wallet", async ({
        queryWrapper,
    }) => {
        ibanStore.getState().mergeRemoteIbans([], WALLET);
        renderHook(() => useMoneriumBeneficiarySync(true), {
            wrapper: queryWrapper.wrapper,
        });
        expect(mocks.get).not.toHaveBeenCalled();
    });

    test("does nothing while not connected", async ({ queryWrapper }) => {
        renderHook(() => useMoneriumBeneficiarySync(false), {
            wrapper: queryWrapper.wrapper,
        });
        expect(mocks.get).not.toHaveBeenCalled();
    });

    test("syncs again when the marker belongs to another wallet", async ({
        queryWrapper,
    }) => {
        ibanStore
            .getState()
            .mergeRemoteIbans([], "0x2222222222222222222222222222222222222222");
        renderHook(() => useMoneriumBeneficiarySync(true), {
            wrapper: queryWrapper.wrapper,
        });
        await waitFor(() =>
            expect(ibanStore.getState().syncedWallet).toBe(WALLET)
        );
    });
});
