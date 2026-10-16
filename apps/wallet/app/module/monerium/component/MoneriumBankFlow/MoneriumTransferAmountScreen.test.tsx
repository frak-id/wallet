/** @jsxImportSource react */
import type * as WalletShared from "@frak-labs/wallet-shared";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ibanStore } from "@/module/monerium/store/ibanStore";
import { moneriumFlowStore } from "@/module/monerium/store/moneriumFlowStore";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({ profileState: { current: "approved" } }));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/module/monerium/hooks/useMoneriumStatus", () => ({
    useMoneriumStatus: () => ({
        status: {
            connection: "connected",
            profile: {
                id: "p",
                kind: "personal",
                state: mocks.profileState.current,
            },
            walletLink: "linked",
            silentReconnect: false,
            environment: "sandbox",
        },
    }),
}));
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => ({
    ...(await importOriginal<typeof WalletShared>()),
    useGetUserBalance: () => ({
        userBalance: { balances: [{ symbol: "EURe", amount: 10 }] },
    }),
}));
vi.mock("./MoneriumScreen", () => ({
    MoneriumScreen: ({
        children,
        ctaLabel,
        ctaDisabled,
    }: {
        children: React.ReactNode;
        ctaLabel: string;
        ctaDisabled?: boolean;
    }) => (
        <div>
            <button type="button" disabled={ctaDisabled}>
                {ctaLabel}
            </button>
            {children}
        </div>
    ),
}));

import { MoneriumTransferAmountScreen } from "./MoneriumTransferAmountScreen";

const OWN_IBAN = "FR7630006000011234567890189";
const CONTINUE = "monerium.bankFlow.transfer.amount.continue";
const OWN_UNAVAILABLE = "monerium.bankFlow.transfer.amount.ownUnavailable";

describe("MoneriumTransferAmountScreen", () => {
    beforeEach(() => {
        ibanStore.setState({
            knownIbans: [
                {
                    iban: OWN_IBAN,
                    firstName: "",
                    lastName: "",
                    pseudo: "Mine",
                    own: true,
                },
            ],
            lastUsedIban: OWN_IBAN,
        });
        moneriumFlowStore.setState({ amount: "1", selectedIbanOverride: null });
    });

    test("blocks an own-account IBAN while the profile is not approved", () => {
        mocks.profileState.current = "pending";
        render(<MoneriumTransferAmountScreen onClose={vi.fn()} />);

        expect(screen.getByText(OWN_UNAVAILABLE)).toBeTruthy();
        expect(
            screen
                .getByRole("button", { name: CONTINUE })
                .hasAttribute("disabled")
        ).toBe(true);
    });

    test("lets an own-account IBAN through once the profile is approved", () => {
        mocks.profileState.current = "approved";
        render(<MoneriumTransferAmountScreen onClose={vi.fn()} />);

        expect(screen.queryByText(OWN_UNAVAILABLE)).toBeNull();
        expect(
            screen
                .getByRole("button", { name: CONTINUE })
                .hasAttribute("disabled")
        ).toBe(false);
    });
});
