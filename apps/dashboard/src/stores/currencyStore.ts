"use client";

import type { Currency } from "@frak-labs/core-sdk";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type CurrencyState = {
    preferredCurrency: Currency;
    setCurrency: (currency: Currency) => void;
};

/**
 * Store for currency preference
 * Persists user's preferred currency selection
 */
export const currencyStore = create<CurrencyState>()(
    persist(
        (set) => ({
            preferredCurrency: "eur",
            setCurrency: (currency) => set({ preferredCurrency: currency }),
        }),
        {
            name: "business_preferredCurrency",
        }
    )
);

/**
 * Selector for preferred currency
 */
export const selectPreferredCurrency = (state: CurrencyState) =>
    state.preferredCurrency;
