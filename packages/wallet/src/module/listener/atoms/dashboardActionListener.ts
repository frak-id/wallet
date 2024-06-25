import type { DashboardActionReturnType } from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai";

type DashboardActionListenerParam = {
    action: string;
    params: string;
    emitter: (response: DashboardActionReturnType) => Promise<void>;
};

/**
 * Atom representing the current dashboard action listener
 */
export const dashboardActionListenerAtom =
    atom<DashboardActionListenerParam | null>(null);
