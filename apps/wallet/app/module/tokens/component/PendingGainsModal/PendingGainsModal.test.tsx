import { currentStablecoins } from "@frak-labs/app-essentials";
import {
    claimableKey,
    sessionStore,
    userBalanceQueryOptions,
} from "@frak-labs/wallet-shared";
import { createMockSession } from "@frak-labs/wallet-shared/test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const token = currentStablecoins.eure;
const oneEur = 10n ** 18n;

const { claimer, claimable, unpaid, getBalance } = vi.hoisted(() => ({
    claimer: "0x47050A6Ba8076F4284Eb8D8d5B0D51ff13F8D869" as const,
    claimable: {
        totalClaimable: 2,
        pendingRewards: [] as {
            token: `0x${string}`;
            amount: bigint;
            decimals: number;
        }[],
    },
    unpaid: { totalUnpaid: 0 },
    getBalance: vi.fn(),
}));

vi.mock("wagmi", () => ({
    useConnection: () => ({ address: claimer }),
    useSendTransaction: () => ({ mutateAsync: async () => "0xhash" }),
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, values?: { amount?: string }) =>
            values?.amount ? `${key}:${values.amount}` : key,
        i18n: { language: "fr-FR" },
    }),
}));
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@frak-labs/wallet-shared")>()),
    authenticatedWalletApi: { balance: { get: getBalance } },
}));
vi.mock("@/module/tokens/hook/useGetPendingRewards", () => ({
    useGetPendingRewards: () => claimable,
}));
vi.mock("@/module/tokens/hook/useGetUnpaidRewards", () => ({
    useGetUnpaidRewards: () => unpaid,
}));

import { PendingGainsModal } from "./index";

function balance(raw: bigint) {
    const eur = Number(raw / oneEur);
    return {
        total: { amount: eur, eurAmount: eur, usdAmount: 0, gbpAmount: 0 },
        balances: raw
            ? [
                  {
                      token,
                      name: "Monerium EURe",
                      symbol: "EURe",
                      decimals: 18,
                      rawBalance: `0x${raw.toString(16)}` as const,
                      amount: eur,
                      eurAmount: eur,
                      usdAmount: 0,
                      gbpAmount: 0,
                  },
              ]
            : [],
    };
}

function renderModal(client = new QueryClient()) {
    const onClose = vi.fn();
    render(
        <QueryClientProvider client={client}>
            <PendingGainsModal onClose={onClose} />
        </QueryClientProvider>
    );
    return { client, onClose };
}

describe("PendingGainsModal", () => {
    beforeEach(() => {
        unpaid.totalUnpaid = 0;
        claimable.totalClaimable = 2;
        claimable.pendingRewards = [];
    });

    it("shows what can be collected now", () => {
        renderModal();

        expect(screen.getByText(/^\+2,00\s€$/)).toBeInTheDocument();
        expect(screen.queryByText(/wallet.pendingGains.unpaid/)).toBeNull();
    });

    it("adds what is still on its way, so it matches the pending box", () => {
        unpaid.totalUnpaid = 1.5;
        renderModal();

        expect(
            screen.getByText(/^wallet\.pendingGains\.unpaid:1,50\s€$/)
        ).toBeInTheDocument();
    });

    describe("after a claim", () => {
        const balanceKey = userBalanceQueryOptions(claimer).queryKey;

        beforeEach(() => {
            vi.useFakeTimers();
            sessionStore
                .getState()
                .setSession(createMockSession({ address: claimer }));
            claimable.totalClaimable = 1;
            claimable.pendingRewards = [
                { token, amount: oneEur, decimals: 18 },
            ];
        });
        afterEach(() => {
            vi.useRealTimers();
            getBalance.mockReset();
            sessionStore.getState().clearSession();
        });

        async function claim() {
            const client = new QueryClient();
            client.setQueryData(balanceKey, balance(0n));
            const result = renderModal(client);
            await act(async () => {
                fireEvent.click(
                    screen.getByText("wallet.pendingGains.confirm")
                );
            });
            return result;
        }

        it("moves the claimed amount from pending to the balance at once", async () => {
            const { client, onClose } = await claim();

            expect(onClose).toHaveBeenCalled();
            expect(
                client.getQueryData(claimableKey.pending.byAddress(claimer))
            ).toEqual([]);
            expect(client.getQueryData(balanceKey)?.total.eurAmount).toBe(1);
        });

        it("makes the claimed EURe transferable at once", async () => {
            const { client } = await claim();

            expect(
                client
                    .getQueryData(balanceKey)
                    ?.balances.find((b) => b.symbol === "EURe")?.amount
            ).toBe(1);
        });

        it("keeps the claimed balance while the backend still reads the old one", async () => {
            getBalance.mockResolvedValue({ data: balance(0n) });
            const { client } = await claim();

            await act(() => vi.advanceTimersByTimeAsync(9_000));

            expect(getBalance).toHaveBeenCalledTimes(3);
            expect(client.getQueryData(balanceKey)?.total.eurAmount).toBe(1);
        });

        it("takes the backend balance once it includes the claim", async () => {
            const settled = balance(oneEur);
            getBalance
                .mockResolvedValueOnce({ data: balance(0n) })
                .mockResolvedValue({ data: settled });
            const { client } = await claim();

            await act(() => vi.advanceTimersByTimeAsync(6_000));

            expect(client.getQueryData(balanceKey)).toEqual(settled);
        });

        it("stops checking the balance once the user logs out", async () => {
            getBalance.mockResolvedValue({ data: balance(5n * oneEur) });
            const { client } = await claim();

            sessionStore.getState().clearSession();
            await act(() => vi.advanceTimersByTimeAsync(9_000));

            expect(getBalance).not.toHaveBeenCalled();
            expect(client.getQueryData(balanceKey)?.total.eurAmount).toBe(1);
        });
    });
});
