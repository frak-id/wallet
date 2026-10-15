import { beforeEach, describe, expect, test } from "vitest";
import {
    IBAN_STORE_NAME,
    type IbanEntry,
    ibanStore,
    mergeIbanEntries,
} from "./ibanStore";

const entry = (iban: string, pseudo: string, own = false): IbanEntry => ({
    iban,
    firstName: own ? "" : "A",
    lastName: own ? "" : "B",
    pseudo,
    own,
});

describe("mergeIbanEntries", () => {
    test("local entries win by normalized IBAN, remote-only ones are appended", () => {
        const merged = mergeIbanEntries(
            [entry("FR7630006000011234567890189", "Mine")],
            [
                entry("fr76 3000 6000 0112 3456 7890 189", "Remote"),
                entry("DE89370400440532013000", "Other"),
                entry("DE89 3704 0044 0532 0130 00", "Duplicate remote"),
            ]
        );
        expect(merged.map((e) => [e.iban, e.pseudo])).toEqual([
            ["FR7630006000011234567890189", "Mine"],
            ["DE89370400440532013000", "Other"],
        ]);
    });
});

describe("ibanStore", () => {
    beforeEach(() => {
        ibanStore.getState().reset();
        localStorage.clear();
    });

    test("mergeRemoteIbans sets the sync marker", () => {
        ibanStore
            .getState()
            .mergeRemoteIbans(
                [entry("DE89370400440532013000", "x")],
                "0x1111111111111111111111111111111111111111"
            );
        expect(ibanStore.getState().syncedWallet).toBe(
            "0x1111111111111111111111111111111111111111"
        );
        expect(ibanStore.getState().knownIbans).toHaveLength(1);
    });

    test("migrates v0 entries with own=false", async () => {
        localStorage.setItem(
            IBAN_STORE_NAME,
            JSON.stringify({
                state: {
                    knownIbans: [
                        {
                            iban: "DE89370400440532013000",
                            firstName: "A",
                            lastName: "B",
                            pseudo: "p",
                        },
                    ],
                    lastUsedIban: null,
                },
                version: 0,
            })
        );
        await ibanStore.persist.rehydrate();
        expect(ibanStore.getState().knownIbans[0]?.own).toBe(false);
        expect(ibanStore.getState().syncedWallet).toBeNull();
    });

    test("re-saving a third-party IBAN as own clears names and country", () => {
        const iban = "DE89370400440532013000";
        ibanStore.getState().addIban({
            ...entry(iban, "Ada"),
            firstName: "Ada",
            lastName: "Lovelace",
            country: "DE",
        });
        ibanStore.getState().addIban({
            iban,
            firstName: "",
            lastName: "",
            pseudo: "Mine",
            own: true,
        });
        expect(ibanStore.getState().knownIbans).toEqual([
            {
                iban,
                firstName: "",
                lastName: "",
                pseudo: "Mine",
                own: true,
                country: undefined,
            },
        ]);
    });

    test("syncing a different wallet replaces the saved list", () => {
        const walletA = "0x1111111111111111111111111111111111111111";
        const walletB = "0x2222222222222222222222222222222222222222";
        ibanStore
            .getState()
            .mergeRemoteIbans([entry("DE89370400440532013000", "A")], walletA);
        ibanStore.getState().setLastUsedIban("DE89370400440532013000");
        ibanStore
            .getState()
            .mergeRemoteIbans(
                [entry("FR7630006000011234567890189", "B")],
                walletB
            );
        expect(ibanStore.getState().knownIbans.map((e) => e.pseudo)).toEqual([
            "B",
        ]);
        expect(ibanStore.getState().lastUsedIban).toBeNull();
        expect(ibanStore.getState().syncedWallet).toBe(walletB);
    });

    test("the first sync keeps entries saved before any wallet was recorded", () => {
        ibanStore.getState().addIban(entry("DE89370400440532013000", "Local"));
        ibanStore
            .getState()
            .mergeRemoteIbans(
                [entry("FR7630006000011234567890189", "Remote")],
                "0x1111111111111111111111111111111111111111"
            );
        expect(ibanStore.getState().knownIbans.map((e) => e.pseudo)).toEqual([
            "Local",
            "Remote",
        ]);
    });
});
