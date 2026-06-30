import { create } from "zustand";
import type { BillingEntry, BillingInfo } from "./types";

/**
 * STUB billing store — in-memory only, seeded with the Figma sample history.
 * Starts with no invoice info so the empty ("Missing infos") state renders first.
 *
 * TODO: replace this whole hook with the Eden Treaty (`@frak-labs/client`)
 * billing endpoints once the backend contract exists.
 */

const STUB_INVOICES: BillingEntry[] = [
    {
        id: "inv-2026-08",
        date: "2026-08-31",
        amount: 423,
        kind: "invoice",
        description: "Monthly statement",
    },
    {
        id: "inv-2026-07",
        date: "2026-07-31",
        amount: 734,
        kind: "invoice",
        description: "Monthly statement",
    },
    {
        id: "inv-2026-06",
        date: "2026-06-30",
        amount: 34,
        kind: "invoice",
        description: "Monthly statement",
    },
    {
        id: "inv-2026-05",
        date: "2026-05-31",
        amount: 424,
        kind: "invoice",
        description: "Monthly statement",
    },
    {
        id: "inv-2026-04",
        date: "2026-04-30",
        amount: 1042,
        kind: "invoice",
        description: "Monthly statement",
    },
    {
        id: "inv-2026-02",
        date: "2026-02-28",
        amount: 528,
        kind: "invoice",
        description: "Monthly statement",
    },
    {
        id: "inv-2026-01",
        date: "2026-01-31",
        amount: 472,
        kind: "invoice",
        description: "Monthly statement",
    },
];

const STUB_DEPOSITS: BillingEntry[] = [
    {
        id: "dep-2026-0038",
        date: "2026-08-31",
        amount: 1000,
        kind: "deposit",
        description: "Campaign refill · ref. DEP-2026-0038",
    },
    {
        id: "dep-2026-0037",
        date: "2026-07-31",
        amount: 500,
        kind: "deposit",
        description: "Campaign 2 · ref. DEP-2026-0037",
    },
    {
        id: "dep-2026-0036",
        date: "2026-06-30",
        amount: 5000,
        kind: "deposit",
        description: "Campaign summer · ref. DEP-2026-0036",
    },
    {
        id: "dep-2026-0035",
        date: "2026-05-31",
        amount: 500,
        kind: "deposit",
        description: "Campaign sales · ref. DEP-2026-0035",
    },
];

type BillingStore = {
    info: BillingInfo | null;
    setInfo: (info: BillingInfo) => void;
};

/**
 * Exported for tests so they can reset the module-level singleton between cases
 * (`useBillingStore.setState({ info: null })`). Not part of the public API.
 */
export const useBillingStore = create<BillingStore>((set) => ({
    info: null,
    setInfo: (info) => set({ info }),
}));

export function useBillingInfo() {
    const info = useBillingStore((s) => s.info);
    const saveInfo = useBillingStore((s) => s.setInfo);

    return {
        info,
        hasInfo: info !== null,
        invoices: STUB_INVOICES,
        deposits: STUB_DEPOSITS,
        saveInfo,
    };
}
