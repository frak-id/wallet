import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { claimable, unpaid } = vi.hoisted(() => ({
    claimable: { totalClaimable: 2, pendingRewards: [] },
    unpaid: { totalUnpaid: 0 },
}));

vi.mock("wagmi", () => ({
    useConnection: () => ({ address: "0x1" }),
    useSendTransaction: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, values?: { amount?: string }) =>
            values?.amount ? `${key}:${values.amount}` : key,
        i18n: { language: "fr-FR" },
    }),
}));
vi.mock("@/module/tokens/hook/useGetPendingRewards", () => ({
    useGetPendingRewards: () => claimable,
}));
vi.mock("@/module/tokens/hook/useGetUnpaidRewards", () => ({
    useGetUnpaidRewards: () => unpaid,
}));

import { PendingGainsModal } from "./index";

function renderModal() {
    return render(
        <QueryClientProvider client={new QueryClient()}>
            <PendingGainsModal onClose={vi.fn()} />
        </QueryClientProvider>
    );
}

describe("PendingGainsModal", () => {
    beforeEach(() => {
        unpaid.totalUnpaid = 0;
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
});
