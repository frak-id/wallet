import {
    getIbanCountry,
    isValidCounterpartName,
    isValidCountryCode,
    isValidIban,
    normalizeIban,
} from "@frak-labs/app-essentials/monerium";
import type { IbanEntry } from "@/module/monerium/store/ibanStore";

export type IbanFormValues = {
    own: boolean;
    iban: string;
    firstName: string;
    lastName: string;
    /** Empty until the user picks one; the IBAN's own country applies meanwhile. */
    country: string;
};

export type IbanFormField = "iban" | "firstName" | "lastName" | "country";

export function resolveCountry(values: IbanFormValues): string {
    return values.country || getIbanCountry(values.iban) || "";
}

/** Fields that block saving; own payouts only need a valid IBAN. */
export function getIbanFormErrors(values: IbanFormValues): IbanFormField[] {
    const errors: IbanFormField[] = [];
    if (!isValidIban(values.iban)) errors.push("iban");
    if (values.own) return errors;
    if (!isValidCounterpartName(values.firstName)) errors.push("firstName");
    if (!isValidCounterpartName(values.lastName)) errors.push("lastName");
    if (!isValidCountryCode(resolveCountry(values))) errors.push("country");
    return errors;
}

export function toIbanEntry(values: IbanFormValues, pseudo: string): IbanEntry {
    const iban = normalizeIban(values.iban);
    if (values.own) {
        return { iban, firstName: "", lastName: "", pseudo, own: true };
    }
    return {
        iban,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        pseudo,
        own: false,
        country: resolveCountry(values),
    };
}
