/** @jsxImportSource react */
import type { MoneriumStatusResponse } from "@backend-domain/monerium/schemas";
import type * as WalletShared from "@frak-labs/wallet-shared";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ibanStore } from "@/module/monerium/store/ibanStore";
import { moneriumFlowStore } from "@/module/monerium/store/moneriumFlowStore";
import { moneriumStatus } from "@/tests/moneriumFixtures";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

type Profile = NonNullable<MoneriumStatusResponse["profile"]>;
type ProfileState = Profile["state"];
type ProfileKind = Profile["kind"];

const mocks = vi.hoisted(() => ({
    profileState: { current: "approved" as ProfileState },
    profileKind: { current: "personal" as ProfileKind },
    eureBalance: { current: 20_000 },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, options?: { amount?: string }) =>
            options?.amount ? `${key}:${options.amount}` : key,
        i18n: { language: "en" },
    }),
}));
vi.mock("@/module/monerium/hooks/useMoneriumStatus", () => ({
    useMoneriumStatus: () => ({
        status: moneriumStatus({
            environment: "sandbox",
            profile: {
                id: "p",
                kind: mocks.profileKind.current,
                state: mocks.profileState.current,
            },
        }),
    }),
}));
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => ({
    ...(await importOriginal<typeof WalletShared>()),
    useGetUserBalance: () => ({
        userBalance: {
            balances: [{ symbol: "EURe", amount: mocks.eureBalance.current }],
        },
    }),
}));

import { MoneriumTransferAmountScreen } from "./MoneriumTransferAmountScreen";

const OWN_IBAN = "FR7630006000011234567890189";
const CONTINUE = "monerium.bankFlow.transfer.amount.continue";
const OWN_UNAVAILABLE = "monerium.bankFlow.transfer.amount.ownUnavailable";
const ABOVE_MAX = "monerium.bankFlow.transfer.amount.aboveMax";
const THIRD_PARTY_IBAN = "DE89370400440532013000";

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
        moneriumFlowStore.setState({ amount: "1" });
        mocks.profileKind.current = "personal";
        mocks.eureBalance.current = 20_000;
    });

    test("shows the balance floored to the cent, matching what can be sent", () => {
        mocks.profileState.current = "approved";
        mocks.eureBalance.current = 12.345;
        moneriumFlowStore.setState({ amount: "12.35" });
        render(<MoneriumTransferAmountScreen onClose={vi.fn()} />);

        expect(
            screen.getByText(
                "monerium.bankFlow.transfer.amount.totalBalance:\u20ac12.34"
            )
        ).toBeTruthy();
        expect(
            screen
                .getByRole("button", { name: CONTINUE })
                .hasAttribute("disabled")
        ).toBe(true);
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

    test.for([
        ["personal", true],
        ["corporate", false],
    ] as const)(
        "a %s profile paying a third party 15 000 EUR is blocked: %s",
        ([kind, blocked]) => {
            mocks.profileKind.current = kind;
            ibanStore.setState({
                knownIbans: [
                    {
                        iban: THIRD_PARTY_IBAN,
                        firstName: "Ada",
                        lastName: "Lovelace",
                        pseudo: "Ada",
                        own: false,
                        country: "DE",
                    },
                ],
                lastUsedIban: THIRD_PARTY_IBAN,
            });
            moneriumFlowStore.setState({ amount: "15000" });
            render(<MoneriumTransferAmountScreen onClose={vi.fn()} />);

            expect(screen.queryByText(ABOVE_MAX) !== null).toBe(blocked);
            expect(
                screen
                    .getByRole("button", { name: CONTINUE })
                    .hasAttribute("disabled")
            ).toBe(blocked);
        }
    );
});
