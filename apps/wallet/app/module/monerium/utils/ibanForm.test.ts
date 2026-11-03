import { describe, expect, test } from "vitest";
import { getIbanFormErrors, resolveCountry, toIbanEntry } from "./ibanForm";

const FR_IBAN = "FR76 3000 6000 0112 3456 7890 189";
const base = {
    own: false,
    iban: FR_IBAN,
    firstName: "Ada",
    lastName: "Lovelace",
    country: "",
};

describe("getIbanFormErrors", () => {
    test("a complete third-party form has no error, country defaulting to the IBAN's", () => {
        expect(getIbanFormErrors(base)).toEqual([]);
        expect(resolveCountry(base)).toBe("FR");
    });

    test("flags a bad checksum", () => {
        expect(
            getIbanFormErrors({ ...base, iban: "FR7630006000011234567890188" })
        ).toEqual(["iban"]);
    });

    test("flags names shorter than 2 characters", () => {
        expect(
            getIbanFormErrors({ ...base, firstName: "A", lastName: " " })
        ).toEqual(["firstName", "lastName"]);
    });

    test("an explicit country wins over the IBAN's", () => {
        expect(resolveCountry({ ...base, country: "BE" })).toBe("BE");
    });

    test("an own account only needs a valid IBAN", () => {
        expect(
            getIbanFormErrors({
                ...base,
                own: true,
                firstName: "",
                lastName: "",
            })
        ).toEqual([]);
        expect(getIbanFormErrors({ ...base, own: true, iban: "nope" })).toEqual(
            ["iban"]
        );
    });
});

describe("toIbanEntry", () => {
    test("own entries carry no names or country", () => {
        expect(toIbanEntry({ ...base, own: true }, "My account")).toEqual({
            iban: "FR7630006000011234567890189",
            firstName: "",
            lastName: "",
            pseudo: "My account",
            own: true,
        });
    });

    test("third-party entries carry the resolved country", () => {
        expect(toIbanEntry(base, "Ada Lovelace")).toMatchObject({
            own: false,
            country: "FR",
            firstName: "Ada",
        });
    });
});
