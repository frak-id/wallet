import { atomWithStorage } from "jotai/utils";

export const preferredCurrencyAtom = atomWithStorage<"eur" | "usd" | "gbp">(
    "business_preferredCurrency",
    "eur"
);
