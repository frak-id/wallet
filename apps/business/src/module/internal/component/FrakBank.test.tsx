import type { FrakBank as FrakBankData } from "@frak-labs/backend-elysia/orchestration/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "en" },
    }),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

const recheck = {
    mutate: vi.fn(),
    isPending: false,
    error: null,
    data: undefined,
};
let bank: FrakBankData;
vi.mock("../api", () => ({
    frakBankQueryOptions: () => ({
        queryKey: ["bank"],
        queryFn: async () => bank,
    }),
    useRecheckBank: () => recheck,
}));

import { FrakBank } from "./FrakBank";

const none = { amount: "0", count: 0 };
const owed = { due: none, depleted: none, processing: none, later: none };
const eur = (amount: number) => (BigInt(amount) * 10n ** 18n).toString();

function data(over: Partial<FrakBankData["tokens"][number]> = {}) {
    return {
        address: "0xd9e65b88B7ABA7c1312FED0CefF2098EB43a9B81",
        isOpen: true,
        checkedAt: new Date(),
        tokens: [
            {
                symbol: "eure" as const,
                address: "0xe",
                decimals: 18,
                balance: eur(100),
                allowance: eur(100),
                payable: eur(100),
                owed,
                shortfall: "0",
                ...over,
            },
        ],
        merchants: [],
        prizes: [],
    };
}

async function renderBank(value: FrakBankData) {
    bank = value;
    render(
        <QueryClientProvider client={new QueryClient()}>
            <Suspense fallback={null}>
                <FrakBank />
            </Suspense>
        </QueryClientProvider>
    );
    await screen.findByText("internal.bank.title");
}

beforeEach(() => recheck.mutate.mockClear());

describe("FrakBank", () => {
    it("says the bank is covered when it can pay what it owes", async () => {
        await renderBank(data());
        expect(
            screen.getByText("internal.bank.token.covered")
        ).toBeInTheDocument();
        expect(
            screen.queryByText("internal.bank.shortfall")
        ).not.toBeInTheDocument();
    });

    it("warns when the bank cannot cover what it owes", async () => {
        await renderBank(
            data({
                payable: eur(10),
                owed: { ...owed, depleted: { amount: eur(50), count: 1 } },
                shortfall: eur(40),
            })
        );
        expect(screen.getByText("internal.bank.shortfall")).toBeInTheDocument();
        expect(
            screen.getByText("internal.bank.token.short")
        ).toBeInTheDocument();
    });

    it("re-checks the bank on demand", async () => {
        await renderBank(data());
        fireEvent.click(
            screen.getByRole("button", {
                name: "internal.bank.recheck.trigger",
            })
        );
        expect(recheck.mutate).toHaveBeenCalledTimes(1);
    });
});
