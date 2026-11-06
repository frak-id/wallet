import { orders, orderTotal } from "./merchant";

/** Léa's bank (fictional), where her Frak earnings land. */
export const bank = {
    name: "Hélia",
    /** Shown masked everywhere but the IBAN field: `FR76 •••• 0143`. */
    iban: "FR76 1695 8000 0143 2177 6420 143",
    holder: "Léa Martin",
    /** Current account balance before the Frak transfer arrives. */
    balance: 1248.32,
    /** How Monerium's SEPA payout reads on a statement. */
    senderName: "FRAK LABS",
} as const;

/** Her statement before the transfer, newest first; the Maison Lune order is from this evening. */
export const bankHistory = [
    {
        label: "Maison Lune",
        detail: "card",
        amount: -orderTotal(orders.lea),
        daysAgo: 0,
    },
    { label: "Monoprix", detail: "card", amount: -23.4, daysAgo: 0 },
    { label: "Navigo", detail: "card", amount: -86.4, daysAgo: 1 },
    { label: "Atelier Nord", detail: "transfer", amount: 2140, daysAgo: 5 },
] as const;
