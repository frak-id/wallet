import type { Currency } from "@frak-labs/core-sdk";
import { atomWithStorage } from "jotai/utils";

export const preferredCurrencyAtom = atomWithStorage<Currency>(
    "business_preferredCurrency",
    "eur"
);
