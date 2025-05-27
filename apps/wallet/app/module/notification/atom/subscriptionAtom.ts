import { atom } from "jotai";

/**
 * Current subscription atom
 */
export const subscriptionAtom = atom<PushSubscription | undefined>(undefined);
