/** @jsxImportSource react */
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ibanStore } from "@/module/monerium/store/ibanStore";
import { moneriumFlowStore } from "@/module/monerium/store/moneriumFlowStore";
import { moneriumStatus } from "@/tests/moneriumFixtures";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

const mocks = vi.hoisted(() => ({ approved: { current: true } }));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "en" },
    }),
}));
vi.mock("@/module/monerium/hooks/useMoneriumStatus", () => ({
    useMoneriumStatus: () => ({
        status: moneriumStatus({
            environment: "sandbox",
            profile: {
                id: "p",
                kind: "personal",
                state: mocks.approved.current ? "approved" : "pending",
            },
        }),
    }),
}));

import { MoneriumTransferIbanScreen } from "./MoneriumTransferIbanScreen";

const KEY = "monerium.bankFlow.transfer.ibanManager";
const IBAN = "DE89370400440532013000";

const field = (name: string) => screen.getByLabelText(`${KEY}.${name}`);
const type = (name: string, value: string) =>
    fireEvent.change(field(name), { target: { value } });
const save = () => screen.getByRole("button", { name: `${KEY}.save` });

describe("MoneriumTransferIbanScreen", () => {
    beforeEach(() => {
        mocks.approved.current = true;
        ibanStore.getState().reset();
        moneriumFlowStore.getState().resetTransfer();
        moneriumFlowStore.getState().goTo("transfer-iban");
    });

    test("an invalid IBAN is reported once the field is left, not while typing", () => {
        render(<MoneriumTransferIbanScreen />);

        type("ibanLabel", "DE12");
        expect(screen.queryByText(`${KEY}.ibanInvalid`)).toBeNull();

        fireEvent.blur(field("ibanLabel"));
        expect(screen.getByText(`${KEY}.ibanInvalid`)).toBeTruthy();
    });

    test("saving needs a valid IBAN and both names", () => {
        render(<MoneriumTransferIbanScreen />);
        expect(save().hasAttribute("disabled")).toBe(true);

        type("ibanLabel", IBAN);
        type("firstNameLabel", "Ada");
        expect(save().hasAttribute("disabled")).toBe(true);

        type("lastNameLabel", "Lovelace");
        expect(save().hasAttribute("disabled")).toBe(false);
    });

    test("a saved third party is labelled with its names, selected and the flow goes back", () => {
        render(<MoneriumTransferIbanScreen />);
        type("ibanLabel", IBAN);
        type("firstNameLabel", " Ada ");
        type("lastNameLabel", "Lovelace");

        fireEvent.click(save());

        expect(ibanStore.getState().knownIbans).toEqual([
            {
                iban: IBAN,
                firstName: "Ada",
                lastName: "Lovelace",
                pseudo: "Ada Lovelace",
                own: false,
                country: "DE",
            },
        ]);
        expect(ibanStore.getState().lastUsedIban).toBe(IBAN);
        expect(moneriumFlowStore.getState().screen).toBe("transfer-amount");
    });

    test("a label the user typed stops following the names", () => {
        render(<MoneriumTransferIbanScreen />);
        type("ibanLabel", IBAN);
        type("firstNameLabel", "Ada");
        type("pseudoLabel", "Rent");
        type("lastNameLabel", "Lovelace");

        fireEvent.click(save());

        expect(ibanStore.getState().knownIbans[0]?.pseudo).toBe("Rent");
    });

    test("an own account asks for no names and gets the own-account label", () => {
        render(<MoneriumTransferIbanScreen />);
        fireEvent.click(
            screen.getByRole("switch", { name: `${KEY}.ownToggle` })
        );
        type("ibanLabel", IBAN);

        expect(screen.queryByLabelText(`${KEY}.firstNameLabel`)).toBeNull();
        fireEvent.click(save());

        expect(ibanStore.getState().knownIbans).toEqual([
            {
                iban: IBAN,
                firstName: "",
                lastName: "",
                pseudo: `${KEY}.ownAccountLabel`,
                own: true,
            },
        ]);
    });

    test("the own-account switch is not offered before the profile is approved", () => {
        mocks.approved.current = false;
        render(<MoneriumTransferIbanScreen />);

        expect(screen.queryByRole("switch")).toBeNull();
    });
});
